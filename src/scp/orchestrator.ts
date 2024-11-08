// Import Libs.
import { once } from 'events';
import { Transform } from 'stream';

// Import @iprolab Libs.
import { Signal, Tags } from '@iprolab/scp';

// Import Local.
import { Incoming, Outgoing } from './definitions';

/**
 * Orchestrator manages the coordination of signals with registered conductors.
 */
export default class Orchestrator {
    /**
     * Conductors registered.
     */
    public readonly conductors: Array<Conductor>;

    /**
     * Creates an instance of `Orchestrator`.
     */
    constructor() {
        // Initialize variables.
        this.conductors = new Array();
    }

    //////////////////////////////
    //////// Conductor
    //////////////////////////////
    /**
     * Creates and registers a new `Conductor`.
     * 
     * @param incoming incoming stream to read.
     * @param outgoing outgoing stream to write.
     */
    public Conductor(incoming: Incoming, outgoing: Outgoing) {
        const condition = new Conductor(incoming, outgoing);
        this.conductors.push(condition);
        return condition;
    }

    //////////////////////////////
    //////// Read/Write Operations
    //////////////////////////////
    /**
     * Sends a signal to all registered conductors and returns a promise that resolves with the received signals.
     * 
     * @param event name of the signal.
     * @param tags optional tags of the signal.
     */
    public async signal(event: string, tags?: Tags) {
        const signals = new Array<Promise<{ event: string, tags: Tags }>>();
        for (const conductor of this.conductors) {
            const signal = (async () => {
                // Write.
                await conductor.signal(event, tags);

                // Read.
                const [emittedEvent, emittedTags] = await once(conductor, 'signal') as [string, Tags];
                return { event: emittedEvent, tags: emittedTags }
            })(); // IIFE 🧑🏽‍💻
            signals.push(signal);
        }
        return await Promise.all(signals);
    }
}

//////////////////////////////
//////// Conductor
//////////////////////////////
/**
 * Conductor transforms blocks into data and emits signals that are read from the `Incoming` stream.
 * It writes blocks and signals into the `Outgoing` stream.
 *
 * A block is a unit of data that is wrapped with `SOB` (Start of block) and `EOB` (End of block) signals,
 * referred to as block signals, which indicate the block's boundaries.
 * 
 * @emits `signal` when a `Signal` is received.
 */
export class Conductor extends Transform {
    /**
     * Incoming stream.
     * Piped to read blocks and signals.
     */
    public readonly incoming: Incoming;

    /**
     * Outgoing stream.
     * Used to write blocks and signals.
     */
    public readonly outgoing: Outgoing;

    /**
     * Creates an instance of `Conductor`.
     * 
     * @param incoming incoming stream to read.
     * @param outgoing outgoing stream to write.
     */
    constructor(incoming: Incoming, outgoing: Outgoing) {
        super({ objectMode: true });

        // Initialize options.
        this.incoming = incoming;
        this.outgoing = outgoing;

        // ⏳ Be a patient ninja. 🥷
        this.incoming.rfi ? this.incoming.pipe(this) : this.incoming.once('rfi', () => this.incoming.pipe(this));
    }

    //////////////////////////////
    //////// Transform
    //////////////////////////////
    /**
     * Implements the transform stream method `_transform`.
     * Pushes all chunks downstream.
     * 
     * WARNING: Should not be called by the consumer.
     * 
     * NOTE: Block signals are not emitted.
     * 
     * @emits `signal` when a `Signal` is received.
     */
    public _transform(chunk: string | Signal, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
        if (typeof chunk !== 'string' && chunk.event !== Block.START && chunk.event !== Block.END) {
            this.emit('signal', chunk.event, chunk.tags); // 🚦
        }

        this.push(chunk);
        callback();
    }

    //////////////////////////////
    //////// Read Operations
    //////////////////////////////
    /**
     * Asynchronous generator reads available data.
     * Skips over `START` block signal.
     * Yields data chunks.
     * Stops and returns when an `END` block signal is encountered.
     */
    public async *[Symbol.asyncIterator]() {
        while (true) {
            const chunk: string | Signal = this.read();
            if (!chunk) {
                // The data will flow when the universe decides. 🧘‍♂️🌌
                await once(this, 'readable');
                continue;
            } else if (typeof chunk !== 'string' && chunk.event === Block.START) {
                continue;
            } else if (typeof chunk === 'string') {
                yield chunk;
            } else if (typeof chunk !== 'string' && chunk.event === Block.END) {
                return;
            }
        }
    }

    //////////////////////////////
    //////// Write Operations
    //////////////////////////////
    /**
     * Writes a block of data to the outgoing stream.
     * 
     * @param chunk data chunk to write as a block.
     */
    public async writeBlock(chunk: string) {
        const chunks = [new Signal(Block.START), chunk, new Signal(Block.END)];
        for await (const chunk of chunks) {
            const write = this.outgoing.write(chunk);
            if (!write) // Ah, backpressure strikes again! 😬
                await once(this.outgoing, 'drain');
        }
    }

    /**
     * Sends a `Signal` to the outgoing stream.
     * 
     * @param event name of the signal.
     * @param tags optional tags of the signal.
     */
    public async signal(event: string, tags?: Tags) {
        const write = this.outgoing.write(new Signal(event, tags));
        if (!write) // Stream's got commitment issues, always needing space. 🤔
            await once(this.outgoing, 'drain');
    }
}

//////////////////////////////
//////// Block
//////////////////////////////
/**
 * Defines the boundaries of a block.
 */
enum Block {
    /**
     * Start of block.
     */
    START = 'SOB',

    /**
     * End of block.
     */
    END = 'EOB',
}