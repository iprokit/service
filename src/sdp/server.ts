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
	 * Underlying UDP Socket.
	 */
	private readonly [socket]: UdpSocket;

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
	 * `true` when the server is listening for connections, `false` otherwise.
	 */
	#listening: boolean;

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
		this[socket] = createSocket({ type: 'udp4', reuseAddr: true });
		this.#membership = null;
		this.#localPort = null;
		this.#localAddress = null;
		this.#listening = false;

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
		return this.#listening;
	}

	/**
	 * Retrieves the bound address, family, and port of the server as reported by operating system.
	 */
	public address() {
		return this.#listening ? this[socket].address() : null;
	}

	//////////////////////////////
	//////// Event Listeners
	//////////////////////////////
	/**
	 * @emits `available` when a pod is available.
	 * @emits `unavailable` when a pod is unavailable.
	 */
	private onMessage(buffer: Buffer, remoteInfo: RemoteInfo) {
		const { identifier, available, attributes } = Pod.objectify(buffer.toString());
		const { address: host } = remoteInfo;

		if (identifier === this.identifier) {
			this[socket].emit('echo', host);
			return;
		}

		// Be ready to be confused. 😈
		const foundPod = this.pods.get(identifier);
		if (!foundPod) {
			this.pods.set(identifier, { available: true, attributes, host });
			this.send(true, () => this.emit('available', identifier, attributes, host));
		} else {
			if (available && !foundPod.available) {
				this.pods.set(identifier, { available: true, attributes, host });
				this.send(true, () => this.emit('available', identifier, attributes, host)); // Server restarted.
			} else if (!available && foundPod.available) {
				this.pods.set(identifier, { available: false, attributes: null, host: null });
				this.emit('unavailable', identifier); // Server shutting down.
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
		this[socket].send(pod.stringify(), this.#localPort!, this.#membership!, (error: Error | null) => callback && callback());
	}

	/**
	 * Encodes and multicasts a pod on the network, then waits for an echo.
	 *
	 * @param available `true` for an available pod, `false` otherwise.
	 * @param callback called once the echo is received.
	 */
	private echo(available: boolean, callback: (address: string) => void) {
		// Read
		this[socket].once('echo', (address: string) => callback(address));

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

		this.#localPort = port;
		this.#membership = address;
		this[socket].bind(this.#localPort!, () => {
			this[socket].addMembership(this.#membership!);
			this.echo(true, (address: string) => {
				this.#localAddress = address;
				this.#listening = true;
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

		this.echo(false, (address: string) => {
			this[socket].dropMembership(this.#membership!);
			this[socket].close(() => {
				this.#membership = null;
				this.#localPort = null;
				this.#localAddress = null;
				this.#listening = false;
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
