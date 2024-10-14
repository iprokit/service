//Import Libs.
import { EventEmitter } from 'events';
import { AddressInfo } from 'net';

//Import @iprolab Libs.
import { Pod, Attrs, Socket, Sender } from '@iprolab/sdp';

/**
 * This class is used to create a SDP server.
 * A `Server` is bound to a multicast address, port number and listens for pods on the network.
 * 
 * @emits `listening` when the server has been bound after calling `server.listen()`.
 * @emits `available` when a pod is available.
 * @emits `unavailable` when a pod is unavailable.
 * @emits `error` when an error occurs.
 * @emits `close` when the server is fully closed.
 */
export default class Server extends EventEmitter {
    /**
     * The unique identifier of the server.
     */
    public readonly identifier: string;

    /**
     * The attributes of the server.
     */
    public readonly attrs: Attrs;

    /**
     * The pods discovered.
     */
    public readonly pods: Map<string, IPod>;

    /**
     * The local address of the server.
     */
    private _localAddress: string | null;

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
        this._socket = new Socket();

        //Bind listeners.
        this.onPod = this.onPod.bind(this);

        //Add listeners.
        this._socket.addListener('pod', this.onPod);
        this._socket.addListener('error', (error: Error) => this.emit('error', error));
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
        return this._socket.listening;
    }

    /**
     * The multicast groups joined.
     */
    public get memberships() {
        return this._socket.memberships;
    }

    /**
     * The bound address, the address family name and port of the server as reported by the operating system.
     */
    public address() {
        return this._socket.address();
    }

    //////////////////////////////
    //////Event Listeners
    //////////////////////////////
    /**
     * @emits `available` when a pod is available.
     * @emits `unavailable` when a pod is unavailable.
     */
    private onPod(pod: Pod, sender: Sender) {
        const { identifier, available, attrs } = pod;
        const { address: host } = sender;

        if (identifier === this.identifier) { /* ECHO */
            this._socket.emit('echo', host);
            return;
        }

        //Be ready to be confused 😈.
        const foundPod = this.pods.get(identifier);
        if (!foundPod) { /* NEW */
            this.pods.set(identifier, { available: true, attrs, host });
            this.send(true, () => this.emit('available', identifier, attrs, host));
            return;
        }
        if (foundPod) { /* EXISTING */
            if (available && !foundPod.available) { /* Server restarted. */
                this.pods.set(identifier, { available: true, attrs, host });
                this.send(true, () => this.emit('available', identifier, attrs, host));
                return;
            }
            if (!available && foundPod.available) { /* Server shutting down. */
                this.pods.set(identifier, { available: false, attrs: null, host: null });
                this.emit('unavailable', identifier);
                return;
            }
            if (!available && !foundPod.available) return;
            if (available && foundPod.available) return;
        }
    }

    //////////////////////////////
    //////Send/Echo
    //////////////////////////////
    /**
     * Encodes and multicasts a pod on the network.
     * 
     * @param available set true for an available pod, false otherwise.
     * @param callback called once the pod is multicasted.
     */
    private send(available: boolean, callback?: () => void) {
        const pod = new Pod(this.identifier, available, this.attrs);
        const address = this._socket.address() as AddressInfo;

        //If you can spare a moment to notice, there's just one membership here 🙃
        this._socket.send(pod, address.port, [...this._socket.memberships][0], (error: Error | null) => callback && callback());
    }

    /**
     * Encodes and multicasts a pod on the network, then waits for an echo.
     * 
     * @param available set true for an available pod, false otherwise.
     * @param callback called once the echo is received.
     */
    private echo(available: boolean, callback: (address: string) => void) {
        //Read
        this._socket.once('echo', (address: string) => callback(address));

        //Write
        this.send(available);
    }

    //////////////////////////////
    //////Connection Management
    //////////////////////////////
    /**
     * Starts listening for pods on the network, the `listening` event will be emitted.
     * 
     * @param port the local port.
     * @param address the address of the multicast group.
     * @param callback the optional callback will be added as a listener for the `listening` event once.
     */
    public listen(port: number, address: string, callback?: () => void) {
        callback && this.once('listening', callback);

        this._socket.bind(port, () => {
            this._socket.addMembership(address);
            this.echo(true, (localAddress: string) => {
                this._localAddress = localAddress;
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
        callback && this.once('close', callback);

        this.echo(false, (localAddress: string) => {
            this._localAddress = null;
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
        this._socket.ref();
        return this;
    }

    /**
     * Unref the server.
     * If the server is unrefed calling unref again will have no effect.
     */
    public unref() {
        this._socket.unref();
        return this;
    }
}

//////////////////////////////
//////IPod
//////////////////////////////
/**
 * Interface of `Pod`.
 */
export interface IPod {
    /**
     * True if the entity is available, false otherwise.
     */
    available: boolean;

    /**
     * The attributes of entity.
     */
    attrs: Attrs | null;

    /**
     * The host address of entity.
     */
    host: string | null;
}