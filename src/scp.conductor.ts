//Import Libs.
import { EventEmitter, once } from 'events';

//Import @iprolab Libs.
import { Signal, Incoming, Outgoing } from '@iprolab/scp';

export default class Conductor extends EventEmitter {
    public incoming!: Incoming;
    public outgoing!: Outgoing;

    constructor() {
        super();
    }

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    public setIO(incoming: Incoming, outgoing: Outgoing) {
        this.incoming = incoming;
        this.outgoing = outgoing;
        this.incoming.once('EOB', () => {
            this.incoming.on('data', (chunk: Signal) => {
                if (chunk instanceof Signal) {
                    this.emit('signal', chunk.event, chunk.args);
                }
            });
        });
        return this;
    }

    //////////////////////////////
    //////Read
    //////////////////////////////
    public async *[Symbol.asyncIterator]() {
        while (true) {
            const chunk: string | Signal = this.incoming.read();
            if (!chunk) {
                await once(this.incoming, 'readable');
                continue;
            }
            if (typeof chunk === 'string') {
                yield chunk;
            }
            if (chunk instanceof Signal && chunk.event === 'EOB') {
                this.incoming.emit('EOB');
                return;
            }
        }
    }

    //////////////////////////////
    //////Write
    //////////////////////////////
    public async writeBlock(chunk: string) {
        const chunks = [chunk, new Signal('EOB')];
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