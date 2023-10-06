//Import Libs.
import { EventEmitter } from 'events';

//Import @iprotechs Libs.
import { Pod, Attrs, Socket, Sender } from '@iprotechs/sdp';

/**
 * The `ScpServer` class is bound to a multicast address and port number.
 * It listens for pods on the network and multicasts to the received pods.
 * 
 * @emits `listening` when the server has been bound after calling `server.listen()`.
 * @emits `discover` when a pod is discovered.
 * @emits `update` when a pod is updated.
 * @emits `error` when an error occurs.
 * @emits `close` when the server is fully closed.
 */
export default class SdpServer extends EventEmitter {
    /**
     * The unique identifier of the server.
     */
    public readonly identifier: string;

    /**
     * The attributes to multicast.
     */
    public readonly attrs: Attrs;

    /**
     * The pods discovered.
     */
    public readonly pods: Map<string, Pod>;

    /**
     * The local address of the server.
     */
    private _localAddress: string;

    /**
     * The underlying SDP Socket.
     */
    private _socket: Socket;

    /**
     * Creates an instance of SDP server.
     * 
     * @param identifier the unique identifier of the server.
     */
    constructor(identifier: string) {
        super();

        //Initialize Options.
        this.identifier = identifier;

        //Initialize Variables.
        this.attrs = new Attrs();
        this.pods = new Map();
        this._localAddress = null;

        //Bind listeners.
        this.onPod = this.onPod.bind(this);
    }

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    /**
     * The local address of the server.
     */
    public get localAddress() {
        return this._localAddress;
    }

    /**
     * True when the server is listening for pods, false otherwise.
     */
    public get listening() {
        return (this._socket) ? this._socket.bound : false;
    }

    /**
     * The multicast groups joined.
     */
    public get memberships() {
        return (this._socket) ? this._socket.memberships : null;
    }

    /**
     * The bound address, the address family name and port of the server as reported by the operating system.
     */
    public address() {
        return (this._socket) ? this._socket.address() : null;
    }

    //////////////////////////////
    //////Event Listeners
    //////////////////////////////
    /**
     * @emits `discover` when a pod is discovered.
     * @emits `update` when a pod is updated.
     */
    private onPod(pod: Pod, sender: Sender) {
        //Pod echo.
        if (pod.identifier === this.identifier) {
            this._localAddress = pod.available ? sender.address : null;
            this._socket.emit('echo');
            return;
        }

        //Copy address to pod.
        pod.set('host', sender.address);

        const _pod = this.pods.get(pod.identifier);
        if (!_pod) { /* DISCOVERED */
            this.pods.set(pod.identifier, pod);
            this.multicast(true, false, () => this.emit('discover', pod));
        }
        if (_pod) { /* UPDATED */
            if (_pod.available !== pod.available) {
                this.pods.set(pod.identifier, pod);
                this.emit('update', pod);
            }
        }
    }

    //////////////////////////////
    //////Multicast
    //////////////////////////////
    /**
     * Encodes and multicasts a pod on the network.
     * 
     * @param available set true for an available pod, false otherwise.
     * @param echo set true to wait for echo event, false otherwise.
     * @param callback called once the pod is multicasted.
     */
    private multicast(available: boolean, echo: boolean, callback: () => void) {
        const pod = new Pod(this.identifier, available, this.attrs);

        //If you can spare a moment to notice, there's just one membership here 🙃
        this._socket.send(pod, this._socket.address().port, this._socket.memberships[0], (error: Error) => {
            if (error) return; /* LIFE HAPPENS!!! */

            //To be or not to be - Shakespeare 🤔
            echo ? this._socket.once('echo', callback) : callback();
        });
    }

    //////////////////////////////
    //////Connection Management
    //////////////////////////////
    /**
     * Starts listening for pods on the network and multicast to received pods, the `listening` event will be emitted.
     * 
     * @param port the local port.
     * @param address the address of the multicast group.
     * @param callback the optional callback will be added as a listener for the `listening` event once.
     */
    public listen(port: number, address: string, callback?: () => void) {
        callback && this.once('listening', callback);

        //Setup Socket.
        this._socket = new Socket();
        this._socket.addListener('pod', this.onPod);
        this._socket.addListener('error', (error: Error) => this.emit('error', error));
        this._socket.bind(port, () => {
            this._socket.addMembership(address);
            this.multicast(true, true, () => {
                this.emit('listening');
            });
        });
        return this;
    }

    /**
     * Closes the underlying socket and stops listening for pods, the `close` event will be emitted.
     * 
     * @param callback optional callback will be added as a listener for the `close` event once.
     */
    public close(callback?: () => void) {
        if (!this._socket) return this;

        callback && this.once('close', callback);
        this.multicast(false, true, () => {
            this._socket.removeMemberships();
            this._socket.close(() => {
                this.emit('close');
            });
        });
        return this;
    }

    //////////////////////////////
    //////Ref/Unref
    //////////////////////////////
    /**
     * Ref the server.
     * If the server is refed calling ref again will have no effect.
     */
    public ref() {
        this._socket?.ref();
        return this;
    }

    /**
     * Unref the server.
     * If the server is unrefed calling unref again will have no effect.
     */
    public unref() {
        this._socket?.unref();
        return this;
    }
}