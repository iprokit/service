// Import Libs.
import { once } from 'events';
import { Transform } from 'stream';

// Import @iprolab Libs.
import { Signal, Tags, Incoming, Outgoing } from '@iprolab/scp';

export default class Conductor extends Transform {
    public incoming!: Incoming;
    public outgoing!: Outgoing;

    constructor() {
        super({ objectMode: true });
    }

    //////////////////////////////
    //////// Gets/Sets
    //////////////////////////////
    public setIO(incoming: Incoming, outgoing: Outgoing) {
        this.incoming = incoming;
        this.outgoing = outgoing;

        // ⏳ Be a patient ninja. 🥷
        this.incoming.rfi ? this.incoming.pipe(this) : this.incoming.once('rfi', () => this.incoming.pipe(this));
        this.outgoing.set('CONDUCTOR', 'TRUE');
        return this;
    }

    //////////////////////////////
    //////// Transform
    //////////////////////////////
    _transform(chunk: string | Signal, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
        if (chunk instanceof Signal) {
            if (chunk.event === 'SOB') {
                this.emit('SOB');
            } else if (chunk.event === 'EOB') {
                this.emit('EOB');
            } else {
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
            if (chunk instanceof Signal && chunk.event === 'SOB') {
                continue;
            }
            if (typeof chunk === 'string') {
                yield chunk;
            }
            if (chunk instanceof Signal && chunk.event === 'EOB') {
                return;
            }
        }
    }

    //////////////////////////////
    //////// Write Operations
    //////////////////////////////
    public async writeBlock(chunk: string) {
        const chunks = [new Signal('SOB'), chunk, new Signal('EOB')];
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