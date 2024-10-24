//Import Libs.
import { once } from 'events';
import { Transform } from 'stream';

//Import @iprolab Libs.
import { Signal, Outgoing } from '@iprolab/scp';

export default class Conductor extends Transform {
    public outgoing!: Outgoing;

    constructor() {
        super({ objectMode: true });
    }

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    public setIO(outgoing: Outgoing) {
        this.outgoing = outgoing;
        return this;
    }

    //////////////////////////////
    //////Inherited: Transform
    //////////////////////////////
    _transform(chunk: string | Signal, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
        if (chunk instanceof Signal) {
            if (chunk.event === 'SOB')
                this.emit('SOB');
            else if (chunk.event === 'EOB')
                this.emit('EOB');
            else
                this.emit('signal', chunk.event, chunk.args);
        }

        this.push(chunk);
        callback();
    }

    //////////////////////////////
    //////Read Operations
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
    //////Write Operations
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

    public async signal(event: string, args?: Iterable<readonly [string, string]>) {
        const write = this.outgoing.write(new Signal(event, args));
        if (!write) {
            await once(this.outgoing, 'drain');
        }
    }
}