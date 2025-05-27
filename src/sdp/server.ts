// Import Libs.
import { EventEmitter } from 'events';
import { Socket as UdpSocket, createSocket, RemoteInfo } from 'dgram';

// Import Local.
import Pod, { Attributes } from './pod';

// Symbol Definitions.
const socket = Symbol('Socket');

/**
 * `Server` binds to a multicast address and port number, listening for incoming SDP client connections.
 * Tracks pods' availability and emits events when their states change.
 *
 * @emits `listening` when the server is bound after calling `listen()`.
 * @emits `available` when a pod becomes available.
 * @emits `unavailable` when a pod becomes unavailable.
 * @emits `error` when an error occurs.
 * @emits `close` when the server is fully closed.
 */
export default class Server extends EventEmitter {
	/**
	 * Pods discovered.
	 */
	public readonly pods: Map<string, IPod>;

	/**
	 * Underlying UDP Socket.
	 */
	private readonly [socket]: UdpSocket;

	/**
	 * Representation of the server as a Pod.
	 */
	#pod: Pod;

	/**
	 * Multicast group that have been joined.
	 */
	#membership: string | null;

	/**
	 * Local port of the server.
	 */
	#localPort: number | null;

	/**
	 * Local address of the server.
	 */
	#localAddress: string | null;

	/**
	 * Creates an instance of SDP `Server`.
	 *
	 * @param identifier unique identifier of the server.
	 */
	constructor(identifier: string) {
		super();

		// Initialize variables.
		this.pods = new Map();
		this[socket] = createSocket({ type: 'udp4', reuseAddr: true });
		this.#pod = new Pod(identifier, Server.UNAVAILABLE_TOKEN);
		this.#membership = null;
		this.#localPort = null;
		this.#localAddress = null;

		// Bind listeners.
		this.onMessage = this.onMessage.bind(this);

		// Add listeners.
		this[socket].addListener('message', this.onMessage);
		this[socket].addListener('error', (error: Error) => this.emit('error', error));
	}

	//////////////////////////////
	//////// Gets/Sets
	//////////////////////////////
	/**
	 * Unique identifier of the server.
	 */
	public get identifier() {
		return this.#pod.identifier;
	}

	/**
	 * Attributes of the server.
	 */
	public get attributes() {
		return this.#pod.attributes;
	}

	/**
	 * Multicast group that have been joined.
	 */
	public get membership() {
		return this.#membership;
	}

	/**
	 * Local port of the server.
	 */
	public get localPort() {
		return this.#localPort;
	}

	/**
	 * Local address of the server.
	 */
	public get localAddress() {
		return this.#localAddress;
	}

	/**
	 * `true` when the server is listening for connections, `false` otherwise.
	 */
	public get listening() {
		return this.#pod.session !== Server.UNAVAILABLE_TOKEN;
	}

	/**
	 * Retrieves the bound address, family, and port of the server as reported by operating system.
	 */
	public address() {
		return this.listening ? this[socket].address() : null;
	}

	//////////////////////////////
	//////// Event Listeners
	//////////////////////////////
	/**
	 * @emits `available` when a pod is available.
	 * @emits `unavailable` when a pod is unavailable.
	 */
	private onMessage(buffer: Buffer, remoteInfo: RemoteInfo) {
		const { identifier, session, attributes } = Pod.objectify(buffer.toString());
		const { address: host } = remoteInfo;

		if (identifier === this.identifier) {
			this[socket].emit('echo', host);
			return;
		}

		// Be ready to be confused. 😈
		const foundPod = this.pods.get(identifier);
		if (foundPod && session === foundPod.session) return;

		if (session !== Server.UNAVAILABLE_TOKEN) {
			this.pods.set(identifier, { session, attributes, host });
			this.send(() => this.emit('available', identifier, attributes, host));
		} else {
			this.pods.set(identifier, { session: Server.UNAVAILABLE_TOKEN, attributes: null, host: null });
			this.emit('unavailable', identifier);
		}
	}

	//////////////////////////////
	//////// Send/Echo
	//////////////////////////////
	/**
	 * Encodes and multicasts `this.#pod` on the network.
	 *
	 * @param callback called once the pod is multicast.
	 */
	private send(callback?: () => void) {
		this[socket].send(this.#pod.stringify(), this.#localPort!, this.#membership!, (error: Error | null) => callback && callback());
	}

	/**
	 * Encodes and multicasts `this.#pod` on the network, then waits for an echo.
	 *
	 * @param callback called once the echo is received.
	 */
	private echo(callback: (address: string) => void) {
		// Read
		this[socket].once('echo', (address: string) => callback(address));

		// Write
		this.send();
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

		this.#localPort = port;
		this.#membership = address;
		this[socket].bind(this.#localPort!, () => {
			this[socket].addMembership(this.#membership!);
			this.#pod.session = Server.createToken();
			this.echo((address: string) => {
				this.#localAddress = address;
				this.emit('listening');
			});
		});
		return this;
	}

	/**
	 * Closes the underlying UDP socket and stops listening for pods, emitting the `close` event.
	 *
	 * @param callback optional callback added as a one-time listener for the `close` event.
	 */
	public close(callback?: () => void) {
		callback && this.once('close', callback);

		this.#pod.session = Server.UNAVAILABLE_TOKEN;
		this.echo((address: string) => {
			this[socket].dropMembership(this.#membership!);
			this[socket].close(() => {
				this.#membership = null;
				this.#localPort = null;
				this.#localAddress = null;
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
		this[socket].ref();
		return this;
	}

	/**
	 * Unreferences the socket, allowing it to close automatically when no other event loop activity is present.
	 * Calling `unref` again has no effect if already unreferenced.
	 */
	public unref() {
		this[socket].unref();
		return this;
	}

	//////////////////////////////
	//////// Session Helpers
	//////////////////////////////
	/**
	 * Returns a new session token for an available pod.
	 */
	private static createToken() {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
		return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
	}

	/**
	 * Session token representing an unavailable pod.
	 */
	public static readonly UNAVAILABLE_TOKEN = '00000';
}

//////////////////////////////
//////// IPod
//////////////////////////////
/**
 * Interface of `Pod`.
 */
export interface IPod {
	/**
	 * Session token of the pod.
	 */
	session: string;

	/**
	 * Attributes of the Pod.
	 */
	attributes: Attributes | null;

	/**
	 * Host address of the Pod.
	 */
	host: string | null;
}
