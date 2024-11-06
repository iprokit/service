// Import Libs.
import { once } from 'events';
import { Transform } from 'stream';

// Import @iprolab Libs.
import { Signal, Tags } from '@iprolab/scp';

// Import Local.
import { Incoming, Outgoing } from './definitions';

export default class Orchestrator {
    public readonly conductors: Array<Conductor>;

    constructor() {
        // Initialize variables.
        this.conductors = new Array();
    }

    //////////////////////////////
    //////// Synchronize
    //////////////////////////////
    public synchronize(incoming: Incoming, outgoing: Outgoing) {
        const condition = new Conductor(incoming, outgoing);
        this.conductors.push(condition);
        return condition;
    }

    //////////////////////////////
    //////// Signal
    //////////////////////////////
    public async signal(event: string, tags?: Tags) {
        return await Promise.all(this.conductors.map(async (conductor) => {
            await conductor.signal(event, tags);
            const [emittedEvent, emittedTags] = await once(conductor, 'signal') as [string, Tags];
            return { event: emittedEvent, tags: emittedTags }
        }));
    }
}

//////////////////////////////
//////// Conductor
//////////////////////////////
export class Conductor extends Transform {
    public readonly incoming: Incoming;
    public readonly outgoing: Outgoing;

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
    _transform(chunk: string | Signal, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
        if (typeof chunk !== 'string') {
            if (chunk.event !== BlockEvent.START && chunk.event !== BlockEvent.END) {
                this.emit('signal', chunk.event, chunk.tags);
            }
        }

        this.push(chunk);
        callback();
    }

    //////////////////////////////
    //////// Read Operations
    //////////////////////////////
    public async *[Symbol.asyncIterator]() {
        while (true) {
            const chunk: string | Signal = this.read();
            if (!chunk) {
                await once(this, 'readable');
                continue;
            }
            if (typeof chunk !== 'string' && chunk.event === BlockEvent.START) {
                continue;
            }
            if (typeof chunk === 'string') {
                yield chunk;
            }
            if (typeof chunk !== 'string' && chunk.event === BlockEvent.END) {
                return;
            }
        }
    }

    //////////////////////////////
    //////// Write Operations
    //////////////////////////////
    public async writeBlock(chunk: string) {
        const chunks = [new Signal(BlockEvent.START), chunk, new Signal(BlockEvent.END)];
        for await (const chunk of chunks) {
            const write = this.outgoing.write(chunk);
            if (!write) {
                await once(this.outgoing, 'drain');
            }
        }
    }

    public async signal(event: string, tags?: Tags) {
        const write = this.outgoing.write(new Signal(event, tags));
        if (!write) {
            await once(this.outgoing, 'drain');
        }
    }
}

//////////////////////////////
//////// Block Event
//////////////////////////////
enum BlockEvent {
    START = 'SOB',
    END = 'EOB',
}