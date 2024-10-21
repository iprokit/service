//Import Libs.
import { EventEmitter, once } from 'events';
import { promises as Stream } from 'stream';

//Import @iprolab Libs.
import { Signal, Incoming, Outgoing } from '@iprolab/scp';

export default class Conductor extends EventEmitter {
    public readonly incoming: Incoming;
    public readonly outgoing: Outgoing;

    constructor(incoming: Incoming, outgoing: Outgoing) {
        super();

        //Initialize Options.
        this.incoming = incoming;
        this.outgoing = outgoing;
    }

    //////////////////////////////
    //////Read Operations
    //////////////////////////////
    public async *[Symbol.asyncIterator]() {
        this.incoming.pause();
        for await (const chunk of this.incoming) {
            this.incoming.pause();
            if (typeof chunk === 'string') {
                yield chunk;
            } else if (chunk?.event === 'END') {
                return;
            }
        }
    }

    //////////////////////////////
    //////Write Operations
    //////////////////////////////
    public async write(chunk: string) {
        const chunks = [chunk, new Signal('END')];
        for await (const chunk of chunks) {
            const write = this.outgoing.write(chunk);
            if (!write) {
                await once(this.outgoing, 'drain');
            }
        }
    }

    //////////////////////////////
    //////Read/Write Operations
    //////////////////////////////
    public async end() {
        this.outgoing.end();
        await Promise.all([Stream.finished(this.incoming), Stream.finished(this.outgoing)]);
    }
}