// Import Libs.
import { EventEmitter } from 'events';

// Import @iprolab Libs.
import { Socket, Pod, Attributes, Sender } from '@iprolab/sdp';

/**
 * SDP server that binds to multicast addresses and port number,
 * and listens for pods on the network.
 * 
 * @emits `listening` when the server is bound after calling `server.listen()`.
 * @emits `available` when a pod becomes available.
 * @emits `unavailable` when a pod becomes unavailable.
 * @emits `error` when an error occurs.
 * @emits `close` when the server is fully closed.
 */
export default class Server extends EventEmitter {
    /**
     * Unique identifier of the server.
     */
    public readonly identifier: string;

    /**
     * Attributes of the server.
     */
    public readonly attributes: Attributes;

    /**
     * Pods discovered.
     */
    public readonly pods: Map<string, IPod>;

    /**
     * Local address of the server.
     */
    private _localAddress: string | null;

    /**
     * Underlying SDP Socket.
     */
    private _socket: Socket;

    /**
     * Creates an instance of SDP `Server`.
     * 
     * @param identifier unique identifier of the server.
     */
    constructor(identifier: string) {
        super();

        // Initialize options.
        this.identifier = identifier;

        // Initialize variables.
        this.attributes = {};
        this.pods = new Map();
        this._localAddress = null;
        this._socket = new Socket();

        // Bind listeners.
        this.onPod = this.onPod.bind(this);

        // Add listeners.
        this._socket.addListener('pod', this.onPod);
        this._socket.addListener('error', (error: Error) => this.emit('error', error));
    }

    //////////////////////////////
    //////// Gets/Sets
    //////////////////////////////
    /**
     * Local address of the server.
     */
    public get localAddress() {
        return this._localAddress;
    }

    /**
     * `true` if the server is listening for connections, `false` otherwise.
     */
    public get listening() {
        return this._socket.listening;
    }

    /**
     * Multicast groups that have been joined.
     */
    public get memberships() {
        return this._socket.memberships;
    }

    /**
     * Retrieves the bound address, family, and port of the server as reported by operating system.
     */
    public address() {
        return this._socket.address();
    }

    //////////////////////////////
    //////// Event Listeners
    //////////////////////////////
    /**
     * @emits `available` when a pod is available.
     * @emits `unavailable` when a pod is unavailable.
     */
    private onPod(pod: Pod, sender: Sender) {
        const { identifier, available, attributes } = pod;
        const { address: host } = sender;

        if (identifier === this.identifier) { // ECHO
            this._socket.emit('echo', host);
            return;
        }

        // Be ready to be confused. 😈
        const foundPod = this.pods.get(identifier);
        if (!foundPod) { // NEW
            this.pods.set(identifier, { available: true, attributes, host });
            this.send(true, () => this.emit('available', identifier, attributes, host));
        } else { // EXISTING
            if (available && !foundPod.available) { // Server restarted.
                this.pods.set(identifier, { available: true, attributes, host });
                this.send(true, () => this.emit('available', identifier, attributes, host));
            } else if (!available && foundPod.available) { // Server shutting down.
                this.pods.set(identifier, { available: false, attributes: null, host: null });
                this.emit('unavailable', identifier);
            } else if (!available && !foundPod.available) {
                return;
            } else if (available && foundPod.available) {
                return;
            }
        }
    }

    //////////////////////////////
    //////// Send/Echo
    //////////////////////////////
    /**
     * Encodes and multicasts a pod on the network.
     * 
     * @param available `true` for an available pod, `false` otherwise.
     * @param callback called once the pod is multicast.
     */
    private send(available: boolean, callback?: () => void) {
        const pod = new Pod(this.identifier, available, this.attributes);
        const address = this._socket.address()!;

        // If you can spare a moment to notice, there's just one membership here. 🙃
        this._socket.send(pod, address.port, [...this._socket.memberships][0], (error: Error | null) => callback && callback());
    }

    /**
     * Encodes and multicasts a pod on the network, then waits for an echo.
     * 
     * @param available `true` for an available pod, `false` otherwise.
     * @param callback called once the echo is received.
     */
    private echo(available: boolean, callback: (address: string) => void) {
        // Read
        this._socket.once('echo', (address: string) => callback(address));

        // Write
        this.send(available);
    }

    //////////////////////////////
    //////// Connection Management
    //////////////////////////////
    /**
     * Starts listening for pods on the network and emits `listening` event.
     * 
     * @param port local port.
     * @param address address of the multicast group.
     * @param callback optional callback added as a one-time listener for the `listening` event.
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
     * Closes the underlying socket and stops listening for pods, emitting the `close` event.
     * 
     * @param callback optional callback added as a one-time listener for the `close` event.
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
    //////// Ref/Unref
    //////////////////////////////
    /**
     * References the socket, preventing it from closing automatically.
     * Calling `ref` again has no effect if already referenced.
     */
    public ref() {
        this._socket.ref();
        return this;
    }

    /**
      * Unreferences the socket, allowing it to close automatically when no other event loop activity is present.
      * Calling `unref` again has no effect if already unreferenced.
      */
    public unref() {
        this._socket.unref();
        return this;
    }
}

//////////////////////////////
//////// IPod
//////////////////////////////
/**
 * Interface of `Pod`.
 */
export interface IPod {
    /**
     * `true` if the Pod is available, `false` otherwise.
     */
    available: boolean;

    /**
     * Attributes of the Pod.
     */
    attributes: Attributes | null;

    /**
     * Host address of the Pod.
     */
    host: string | null;
}