//Import Libs.
import { EventEmitter } from 'events';

//Import @iprotechs Libs.
import { Pod, Attrs, Socket, Sender } from '@iprotechs/sdp';

export default class SdpServer extends EventEmitter {
    public readonly identifier: string;
    public attrs: Attrs;

    public readonly pods: Array<Pod>;

    private _localAddress: string;
    private _multicastAddress: string;

    private _listening: boolean;

    private _socket: Socket;

    constructor(identifier: string) {
        super();

        //Initialize Options.
        this.identifier = identifier;

        //Initialize Variables.
        this.attrs = {};
        this.pods = new Array();
        this._localAddress = null;
        this._multicastAddress = null;
        this._listening = false;

        //Bind listeners.
        this.onPod = this.onPod.bind(this);
    }

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    public get listening() {
        return this._listening;
    }

    public get localAddress() {
        return this._localAddress;
    }

    public get multicastAddress() {
        return this._multicastAddress;
    }

    public address() {
        return (this._socket) ? this._socket.address() : null;
    }

    //////////////////////////////
    //////Event Listeners
    //////////////////////////////
    private onPod(pod: Pod, sender: Sender) {
        //Pod echo.
        if (pod.identifier === this.identifier) {
            this._localAddress = pod.available ? sender.address : null;
            this._socket.emit('echo');
            return;
        }

        const index = this.pods.findIndex(({ identifier }) => identifier === pod.identifier);
        pod.attrs.address = sender.address; //Copy address to pod.

        //Pod discover.
        if (index === -1) {
            this.pods.push(pod);
            this.multicast(true, () => this.emit('discover', pod));
        }

        //Pod update.
        if (index >= 0) {
            if (this.pods[index].available !== pod.available) {
                this.pods[index] = pod;
                this.emit('update', pod);
            }
        }
    }

    //////////////////////////////
    //////Multicast
    //////////////////////////////
    private multicast(available: boolean, callback: () => void) {
        const pod = new Pod(this.identifier, available, this.attrs);
        this._socket.send(pod, this.address().port, this.multicastAddress, (error: Error) => {
            if (error) return; /* LIFE HAPPENS!!! */

            this._socket.once('echo', callback);
        });
    }

    //////////////////////////////
    //////Connection Management
    //////////////////////////////
    public listen(port: number, multicast: string, attrs: Attrs, callback?: () => void) {
        callback && this.once('listening', callback);

        //Setup Socket.
        this._socket = new Socket();
        this._socket.addListener('pod', this.onPod);
        this._socket.addListener('error', (error: Error) => this.emit('error', error));
        this._socket.bind(port, () => {
            this._multicastAddress = multicast;
            this._socket.addMembership(this.multicastAddress);
            this.attrs = attrs;
            this.multicast(true, () => {
                this._listening = true;
                this.emit('listening');
            });
        });
        return this;
    }

    public close(callback?: () => void) {
        if (!this._socket) return this;

        callback && this.once('close', callback);
        this.multicast(false, () => {
            this._socket.removeMembership(this.multicastAddress);
            this._multicastAddress = null;
            this.attrs = {};
            this._socket.close(() => {
                this._listening = false;
                this.emit('close');
            });
        });
        return this;
    }

    //////////////////////////////
    //////Ref/Unref
    //////////////////////////////
    public ref() {
        this._socket?.ref();
        return this;
    }

    public unref() {
        this._socket?.unref();
        return this;
    }
}