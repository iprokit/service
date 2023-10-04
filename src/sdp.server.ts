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
    public attrs: Attrs;

    /**
     * The pods discovered.
     */
    public readonly pods: Array<Pod>;

    /**
     * The local address of the server.
     */
    private _localAddress: string;

    /**
     * The multicast address of the server.
     */
    private _multicastAddress: string;

    /**
    * True when the server is listening for pods, false otherwise.
    */
    private _listening: boolean;

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
    /**
     * True when the server is listening for pods, false otherwise.
     */
    public get listening() {
        return this._listening;
    }

    /**
     * The local address of the server.
     */
    public get localAddress() {
        return this._localAddress;
    }

    /**
     * The multicast address of the server.
     */
    public get multicastAddress() {
        return this._multicastAddress;
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
    /**
     * Encodes and multicasts a pod on the network.
     * 
     * @param available set to true for an available pod, false otherwise.
     * @param callback called once the pod is multicasted.
     */
    private multicast(available: boolean, callback: () => void) {
        const pod = new Pod(this.identifier, available, this.attrs);
        this._socket.send(pod, this.address().port, this.multicastAddress, (error: Error) => {
            if (error) return; /* LIFE HAPPENS!!! */

            //Waiting for the echo!!!
            this._socket.once('echo', callback);
        });
    }

    //////////////////////////////
    //////Connection Management
    //////////////////////////////
    /**
     * Start listening for pods on the network and multicast to received pods.
     * 
     * @param port the local port.
     * @param multicast the multicast address.
     * @param attrs the attributes to multicast.
     * @param callback the optional callback will be added as a listener for the `listening` event once.
     */
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

    /**
     * Closes the underlying socket and stops listening for pods.
     * 
     * @param callback optional callback will be added as a listener for the `close` event once.
     */
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