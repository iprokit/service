// Import Libs.
import EventEmitter, { once } from 'events';
import { promises as Stream } from 'stream';

// Import @iprolab Libs.
import { Signal, Tags } from '@iprolab/scp';

// Import Local.
import { Incoming, Outgoing } from './definitions';

/**
 * Orchestrator manages the life cycle of multiple `Conductor` instances and coordinates signals.
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
        this.conductors = new Array();
    }

    //////////////////////////////
    //////// Manage
    //////////////////////////////
    /**
     * Manges multiple conductors.
     * 
     * @param conductors conductors to manage.
     */
    public manage(...conductors: Array<Conductor>) {
        this.conductors.push(...conductors);
        return this;
    }

    //////////////////////////////
    //////// Read/Write Operations
    //////////////////////////////
    /**
     * Writes a signal to all the conductors and returns a promise that resolves with the result of the signals.
     * 
     * @param event name of the signal.
     * @param tags optional tags of the signal.
     */
    public async signal(event: string, tags?: Tags) {
        const signals = new Array<Promise<{ event: string, tags: Tags }>>();
        for (const conductor of this.conductors) {
            const signal = (async () => {
                await conductor.signal(event, tags); // Write.
                const [emittedEvent, emittedTags] = await once(conductor, 'signal') as [string, Tags]; // Read.
                return { event: emittedEvent, tags: emittedTags }
            })(); // IIFE 🧑🏽‍💻
            signals.push(signal);
        }
        return await Promise.all(signals);
    }

    /**
     * Ends all the conductors.
     */
    public async end() {
        const ends = Array<Promise<void>>();
        for (const conductor of this.conductors) {
            const end = (async () => {
                await conductor.end(); // Write.
                await once(conductor, 'end'); // Read.
            })(); // IIFE 🧑🏽‍💻
            ends.push(end);
        }
        await Promise.all(ends);
    }
}

//////////////////////////////
//////// Conductor
//////////////////////////////
/**
 * Conductor manages the flow of `Block` and `Signal` between incoming and outgoing streams.
 * 
 * A block is a unit of data that is wrapped with `SOB` (Start of block) and `EOB` (End of block) signals,
 * referred to as block signals, which indicate the block's boundaries.
 * 
 * @emits `signal` when signal is received on the incoming stream.
 * @emits `end` when end is received on the incoming stream.
 */
export class Conductor extends EventEmitter {
    /**
     * Incoming stream to read.
     */
    public readonly incoming: Incoming;

    /**
     * Outgoing stream to write.
     */
    public readonly outgoing: Outgoing;

    /**
     * Creates an instance of `Conductor`.
     * 
     * @param incoming incoming stream to read.
     * @param outgoing outgoing stream to write.
     */
    constructor(incoming: Incoming, outgoing: Outgoing) {
        super();

        // Initialize options.
        this.incoming = incoming;
        this.outgoing = outgoing;

        // Add listeners.
        this.incoming.addListener('end', () => this.emit('end'));
    }

    //////////////////////////////
    //////// Read Operations
    //////////////////////////////
    /**
     * Asynchronous iterator.
     * Reads a `Block` from the incoming stream.
     */
    public async *[Symbol.asyncIterator]() {
        yield* this.readBlock();
    }

    /**
     * Reads a `Block` from the incoming stream.
     * 
     * NOTE: When `END` block signal is encountered, control is passed to `readSignal`.
     * 
     * @yields data chunk of the block received on the incoming stream.
     */
    private async *readBlock() {
        while (true) {
            const chunk: string | Signal = this.incoming.read();
            if (!chunk) {
                // Ready or not, here we wait! 👀
                await once(this.incoming, 'readable');
                continue;
            } else if (chunk instanceof Signal && chunk.event === Conductor.START) {
                continue;
            } else if (typeof chunk === 'string') {
                yield chunk;
            } else if (chunk instanceof Signal && chunk.event === Conductor.END) {
                this.readSignal();
                return; // Switching to signal reading mode using `readSignal`.
            }
        }
    }

    /**
     * Reads a `Signal` from the incoming stream.
     * 
     * NOTE: When `START` block signal is encountered, control is passed to `readBlock`.
     * 
     * @emits `signal` when signal is received on the incoming stream.
     */
    private async readSignal() {
        while (true) {
            const chunk: string | Signal = this.incoming.read();
            if (!chunk) {
                // Waiting for a clearer sign! 🔮
                await once(this.incoming, 'readable');
                continue;
            } else if (chunk instanceof Signal && !(chunk.event === Conductor.START || chunk.event === Conductor.END)) {
                this.emit('signal', chunk.event, chunk.tags);
            } else if (chunk instanceof Signal && chunk.event === Conductor.START) {
                this.incoming.unshift(chunk);
                return; // Switching to block reading mode using `readBlock`.
            }
        }
    }

    //////////////////////////////
    //////// Write Operations
    //////////////////////////////
    /**
     * Writes a `Block` to the outgoing stream.
     * 
     * @param chunk data chunk of the block.
     */
    public async writeBlock(chunk: string) {
        await this.write(new Signal(Conductor.START));
        await this.write(chunk);
        await this.write(new Signal(Conductor.END));
    }

    /**
     * Writes a `Signal` to the outgoing stream.
     * 
     * @param event name of the signal.
     * @param tags optional tags of the signal.
     */
    public async signal(event: string, tags?: Tags) {
        await this.write(new Signal(event, tags));
    }

    /**
     * Writes data to the outgoing stream.
     * 
     * @param chunk chunk to write.
     */
    private async write(chunk: string | Signal) {
        const write = this.outgoing.write(chunk);
        if (!write) {
            // Ah, backpressure strikes again! 😬
            await once(this.outgoing, 'drain');
        }
    }

    //////////////////////////////
    //////// End
    //////////////////////////////
    /**
     * Ends the outgoing stream.
     */
    public async end() {
        this.outgoing.end();
        await Stream.finished(this.outgoing);
    }

    //////////////////////////////
    //////// Block Definitions
    //////////////////////////////
    /**
     * Indicates start of block.
     */
    public static readonly START = 'SOB';

    /**
     * Indicates end of block.
     */
    public static readonly END = 'EOB';
}