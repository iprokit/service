//Import Libs.
import { EventEmitter, once } from 'events';

//Import @iprolab Libs.
import { Signal, Args, Incoming, Outgoing } from '@iprolab/scp';

export default class Conductor extends EventEmitter {
    public incoming!: Incoming;
    public outgoing!: Outgoing;

    constructor() {
        super();
    }

    public assign(incoming: Incoming, outgoing: Outgoing) {
        this.incoming = incoming;
        this.outgoing = outgoing;
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

    public async signal(event: string, args: Args) {
        const write = this.outgoing.write(new Signal(event, args));
        if (!write) {
            await once(this.outgoing, 'drain');
        }
    }
}