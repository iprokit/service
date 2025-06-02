/**
 * @iProKit/Service
 * Copyright (c) 2019-2025 Rutvik Katuri / iProTechs
 * SPDX-License-Identifier: Apache-2.0
 */

// Import Libs.
import { EventEmitter, once } from 'events';
import { promises as Stream } from 'stream';
import { Socket as TcpSocket } from 'net';

// Import Local.
import { Mode, Parameters } from './rfi';
import Protocol, { Incoming, Outgoing } from './protocol';
import Coordinator, { Conductor } from './coordinator';

// Symbol Definitions.
const pool = Symbol('Pool');

/**
 * `Client` manages connections to an SCP server.
 * Once connected, it subscribes to receive broadcasts and handles the executions.
 *
 * @emits `connect` when the connection is successfully established.
 * @emits `<operation>` when a broadcast is received.
 * @emits `pool:create` when a new socket is created and added to the connection pool.
 * @emits `pool:acquire` when a socket is acquired from the connection pool.
 * @emits `pool:drain`  when all sockets(message) are removed from the connection pool.
 * @emits `error` when an error occurs.
 * @emits `close` when all the connections are closed.
 */
export default class Client extends EventEmitter {
	/**
	 * Unique identifier of the client.
	 */
	public readonly identifier: string;

	/**
	 * Socket connection pool.
	 */
	private readonly [pool]: Array<Socket>;

	/**
	 * Options of the client.
	 */
	#options: Options;

	/**
	 * Creates an instance of SCP `Client`.
	 *
	 * @param identifier unique identifier of the client.
	 * @param options options of the client.
	 */
	constructor(identifier: string, options?: Options) {
		super();

		// Initialize options.
		this.identifier = identifier;
		this.#options = options ?? {};
		this.#options.maxPoolSize = this.#options.maxPoolSize ?? 10;
		this.#options.maxMessages = this.#options.maxMessages ?? 100;
		this.#options.idleTimeout = this.#options.idleTimeout ?? 0;

		// Initialize variables.
		this[pool] = new Array();

		// Bind listeners.
		this.onBroadcast = this.onBroadcast.bind(this);
	}

	//////////////////////////////
	//////// Gets/Sets
	//////////////////////////////
	/**
	 * Remote port of the client.
	 */
	public get remotePort() {
		if (this[pool].length === 0) return null;
		return this[pool][0].socket.remotePort!;
	}

	/**
	 * Remote address of the client.
	 */
	public get remoteAddress() {
		if (this[pool].length === 0) return null;
		return this[pool][0].socket.remoteAddress!;
	}

	/**
	 * `true` when all sockets in the pool are connected, `false` otherwise.
	 */
	public get connected() {
		if (this[pool].length === 0) return false;
		return this[pool].every((socket) => socket.connected);
	}

	/**
	 * Returns the current state of the connection pool.
	 */
	public get pool() {
		if (this[pool].length === 0) return { size: 0, busy: 0, idle: 0 };
		const { busy, idle } = this[pool].reduce((counts, socket) => (counts[socket.ioQueue > 0 ? 'busy' : 'idle']++, counts), { busy: 0, idle: 0 });
		return { size: this[pool].length, busy, idle };
	}

	//////////////////////////////
	//////// Subscribe
	//////////////////////////////
	/**
	 * Subscribes to the server to receive broadcasts.
	 */
	private async subscribe(socket: Socket) {
		const { incoming, outgoing } = await this.IO('SUBSCRIBE', '', {}, socket);
		try {
			// Write: Outgoing stream.
			outgoing.end('');
			await Stream.finished(outgoing);

			// Read: Incoming stream.
			await once(incoming, 'rfi');
			incoming.resume();
			await Stream.finished(incoming);
		} catch (error) {
			// ❗️⚠️❗️
			incoming.destroy();
			outgoing.destroy();
		}
	}

	//////////////////////////////
	//////// Broadcast
	//////////////////////////////
	/**
	 * Process the `Incoming` broadcast stream.
	 *
	 * @emits `<operation>` when a broadcast is received.
	 */
	private async onBroadcast(incoming: Incoming) {
		try {
			// No listener was added to the broadcast, Drain the stream. Move on to the next one.
			if (this.listenerCount(incoming.operation) === 0) {
				incoming.resume();
				await Stream.finished(incoming);
				return;
			}

			// Read: Incoming stream.
			let incomingData = new Array<Buffer>();
			for await (const chunk of incoming) {
				incomingData.push(chunk);
			}
			this.emit(incoming.operation, ...JSON.parse(Buffer.concat(incomingData).toString()));
		} catch (error) {
			// ❗️⚠️❗️
			incoming.destroy();
		}
	}

	//////////////////////////////
	//////// Message/Conduct
	//////////////////////////////
	/**
	 * Sends a message to the server and returns a promise resolving to a reply.
	 *
	 * @param operation operation pattern.
	 * @param args arguments to send.
	 */
	public async message<Returned>(operation: string, ...args: Array<any>) {
		const { incoming, outgoing } = await this.IO('REPLY', operation);
		let incomingData = new Array<Buffer>();
		let outgoingData = JSON.stringify(args);

		try {
			// Write: Outgoing stream.
			outgoing.end(outgoingData);
			await Stream.finished(outgoing);

			// Read: Incoming stream.
			await once(incoming, 'rfi');
			for await (const chunk of incoming) {
				incomingData.push(chunk);
			}
		} catch (error) {
			// ❗️⚠️❗️
			incoming.destroy();
			outgoing.destroy();
			throw error;
		}

		if (incoming.parameters.STATUS === 'ERROR') {
			throw Object.assign(new Error(), JSON.parse(Buffer.concat(incomingData).toString())) as Error;
		}
		return JSON.parse(Buffer.concat(incomingData).toString()) as Returned;
	}

	/**
	 * Sends a message to the server and returns a promise that resolves to `void`, enabling the coordination of signals.
	 *
	 * @param operation operation pattern.
	 * @param coordinator coordinator that coordinates signals.
	 * @param args arguments to send.
	 */
	public async conduct(operation: string, coordinator: Coordinator, ...args: Array<any>) {
		const { incoming, outgoing } = await this.IO('CONDUCTOR', operation);
		let outgoingData = JSON.stringify(args);

		const conductor = new Conductor(incoming, outgoing); // 🎩🚦🔲
		coordinator.manage(conductor);
		try {
			// Write: Conductor.
			await conductor.deliver(outgoingData);

			// Read: Conductor.
			await once(incoming, 'rfi');
		} catch (error) {
			// ❗️⚠️❗️
			conductor.destroy();
			throw error;
		}
	}

	//////////////////////////////
	//////// Incoming/Outgoing
	//////////////////////////////
	/**
	 * Creates and returns a new `Incoming` and `Outgoing` stream.
	 *
	 * @param mode mode of the remote function.
	 * @param operation operation of the remote function.
	 * @param parameters optional parameters of the remote function.
	 * @param socket optional socket to use. If not provided, a socket will be acquired from the connection pool.
	 */
	public async IO(mode: Mode, operation: string, parameters?: Parameters, socket?: Socket) {
		if (!this.connected && this[pool].length === 0) throw new Error('NO_CONNECTION');

		parameters = { ...(parameters ?? {}), CID: this.identifier };
		socket = socket ?? this.acquireSocket();
		return new Promise<{ outgoing: Outgoing; incoming: Incoming }>((resolve) => socket.createIO(mode, operation, parameters, (outgoing, incoming) => resolve({ outgoing, incoming })));
	}

	//////////////////////////////
	//////// Connection Pool
	//////////////////////////////
	/**
	 * Returns the least busy and available socket from the connection pool.
	 *
	 * @emits `pool:acquire` when a socket is acquired from the connection pool.
	 */
	private acquireSocket() {
		let socket = this[pool].find((socket) => socket.ioQueue === 0);
		if (socket) {
			// 🤸🏽🪩
		} else {
			if (this[pool].length < this.#options.maxPoolSize!) {
				socket = this.createSocket({ maxMessages: this.#options.maxMessages!, idleTimeout: this.#options.idleTimeout! }, this.remotePort!, this.remoteAddress!);
			} else {
				socket = this[pool].reduce((leastBusy, current) => (current.ioQueue < leastBusy.ioQueue ? current : leastBusy));
			}
		}
		this.emit('pool:acquire', socket);
		return socket;
	}

	/**
	 * Creates and initializes a new connected socket, then adds it to the connection pool.
	 *
	 * @param options options of the socket.
	 * @param port remote port.
	 * @param host remote host.
	 * @emits `pool:create` when a new socket is created and added to the connection pool.
	 * @emits `pool:drain` when all sockets(message) are removed from the connection pool.
	 * @emits `error` when an error occurs.
	 * @emits `close` when all the connections are closed.
	 */
	private createSocket(options: SocketOptions, port: number, host: string) {
		const socket = new Socket(options);
		socket.on('error', (error: Error) => {
			this.emit('error', error, socket);
		});
		socket.on('close', () => {
			// Find the socket and remove it.
			const socketIndex = this[pool].findIndex((s) => s === socket);
			if (socketIndex >= 0) this[pool].splice(socketIndex, 1);

			// 🏄🏽
			if (this[pool].length === 1) {
				this.emit('pool:drain');
			} else if (this[pool].length === 0) {
				this.emit('close');
			}
		});
		socket.connect(port, host);
		this[pool].push(socket);
		this.emit('pool:create', socket);
		return socket;
	}

	//////////////////////////////
	//////// Connection Management
	//////////////////////////////
	/**
	 * Initiates a connection to the server.
	 *
	 * @param port remote port.
	 * @param host remote host.
	 * @param callback optional callback added as a one-time listener for the `connect` event.
	 */
	public connect(port: number, host: string, callback?: () => void) {
		callback && this.once('connect', callback);

		// Socket is reserved for receiving broadcasts. 📡🏃🏽💨
		const socket = this.createSocket({ maxMessages: Infinity, idleTimeout: 0 }, port, host);
		socket.on('broadcast', this.onBroadcast);
		socket.on('connect', () =>
			this.subscribe(socket).then(() => {
				socket.cycleIncoming();
				this.emit('connect');
			})
		);
		return this;
	}

	/**
	 * Closes all connections to the server.
	 *
	 * @param callback optional callback added as a one-time listener for the `close` event.
	 */
	public close(callback?: () => void) {
		callback && this.once('close', callback);

		// 🏁✋🏽
		for (const socket of this[pool]) {
			socket.end();
		}
		return this;
	}
}

//////////////////////////////
//////// Client Options
//////////////////////////////
export interface Options {
	/**
	 * Maximum number of sockets that can exist in the connection pool.
	 * When the limit is reached, no new sockets will be created. Instead,
	 * existing sockets' I/O queue will be used to handle new messages,
	 * leveraging their FIFO mechanism to ensure proper message ordering.
	 *
	 * @default 10
	 */
	maxPoolSize?: number;

	/**
	 * Maximum number of messages that a single socket can process before it is closed.
	 * A new socket will be created for further messages.
	 *
	 * @default 100
	 */
	maxMessages?: number;

	/**
	 * Maximum amount of time (in milliseconds) that a socket can remain idle before it is closed.
	 * The timer resets on activity. If set to `0`, the idle timeout is disabled,
	 * allowing the socket to remain open indefinitely unless explicitly closed.
	 *
	 * @default 0
	 */
	idleTimeout?: number;
}

//////////////////////////////
//////// Socket
//////////////////////////////
/**
 * Represents a socket connection used by the SCP `Client`.
 *
 * @emits `connect` when a connection is successfully established.
 * @emits `<mode>` when a new incoming stream is received.
 * @emits `io:drain` when all callbacks in the I/O queue are executed.
 */
export class Socket extends Protocol {
	/**
	 * RFI + I/O callback queue.
	 */
	readonly #ioQueue: Array<{ mode: Mode; operation: string; parameters: Parameters; callback: (outgoing: Outgoing, incoming: Incoming) => void }>;

	/**
	 * Number of I/O streams processed.
	 */
	#ioProcessed: number;

	/**
	 * - `IO`: Message/Reply mode. Socket processes queued I/O operations.
	 * - `Incoming`: Continuous incoming mode. Socket repeatedly listens for incoming streams.
	 */
	#ioMode: 'IO' | 'Incoming';

	/**
	 * Options of the socket.
	 */
	#options: SocketOptions;

	/**
	 * Creates an instance of SCP `Socket`.
	 *
	 * @param options options of the socket.
	 */
	constructor(options: SocketOptions) {
		super(new TcpSocket());

		// Initialize options.
		this.#options = options;

		// Initialize variables.
		this.#ioQueue = new Array();
		this.#ioProcessed = 0;
		this.#ioMode = 'IO';

		// Add listeners.
		this.socket.addListener('connect', () => this.emit('connect'));
		this.socket.addListener('timeout', () => this.end());
		this.socket.addListener('end', () => !this.readableEnded && this.resume()); // Underlying socket closed. Forcefully read(), triggering `end` event. 🤪
		this.addListener('end', () => this.end());
		this.addListener('error', (error: Error) => this.destroy());

		// Initialize.
		this.socket.setTimeout(this.#options.idleTimeout);
	}

	//////////////////////////////
	//////// Gets/Sets
	//////////////////////////////
	/**
	 * `true` when the socket is connected, `false` otherwise.
	 */
	public get connected() {
		return !this.socket.pending && !this.destroyed && this.socket.readyState === 'open';
	}

	/**
	 * Number of I/O streams queued to process.
	 */
	public get ioQueue() {
		if (this.#ioMode === 'IO') return this.#ioQueue.length;
		return Infinity;
	}

	//////////////////////////////
	//////// Incoming/Outgoing
	//////////////////////////////
	/**
	 * Creates a new `Incoming` and `Outgoing` stream.
	 *
	 * @param mode mode of the remote function.
	 * @param operation operation of the remote function.
	 * @param parameters parameters of the remote function.
	 * @param callback callback executed when the I/O stream is ready.
	 */
	public createIO(mode: Mode, operation: string, parameters: Parameters, callback: (outgoing: Outgoing, incoming: Incoming) => void) {
		// Push the RFI + I/O callback into the queue.
		this.#ioQueue.push({ mode, operation, parameters, callback });

		// This is the first in the queue, let's execute it!
		if (this.#ioQueue.length === 1) {
			this.executeIO();
		}

		return this;
	}

	/**
	 * Executes one I/O callback at a time in FIFO manner.
	 * Invoked recursively on the `close` event of the current incoming stream.
	 *
	 * @emits `io:drain` when all callbacks in the I/O queue are executed.
	 */
	private executeIO() {
		// The first(0th) RFI + I/O callback from the queue.
		const { mode, operation, parameters, callback: firstCallback } = this.#ioQueue[0];

		const incoming = new Incoming(this);
		incoming.once('close', () => {
			this.#ioProcessed++;

			// Remove the first(0th) RFI + I/O callback from the queue.
			this.#ioQueue.shift();

			// 🚨
			if (this.#ioProcessed >= this.#options.maxMessages) return this.end();

			// 🎡
			if (this.#ioQueue.length > 0) {
				this.executeIO();
			} else if (this.#ioQueue.length === 0) {
				this.emit('io:drain');
			}
		});
		const outgoing = new Outgoing(this);
		outgoing.setRFI(mode, operation, parameters);

		// Let's execute the I/O callback!
		firstCallback(outgoing, incoming);
	}

	/**
	 * Creates a new `Incoming` stream.
	 * Invoked recursively on the `close` event of the current incoming stream to continuously listen for incoming streams.
	 *
	 * @emits `<mode>` when a new incoming stream is received.
	 */
	public cycleIncoming() {
		this.#ioMode = 'Incoming'; // 👂🏽🔁
		const incoming = new Incoming(this);
		incoming.once('rfi', () => this.emit(incoming.mode.toLowerCase(), incoming));
		incoming.once('close', () => this.cycleIncoming());
		return this;
	}

	//////////////////////////////
	//////// Connection Management
	//////////////////////////////
	/**
	 * Initiates a connection to the server.
	 *
	 * @param port remote port.
	 * @param host remote host.
	 * @param callback optional callback added as a one-time listener for the `connect` event.
	 */
	public connect(port: number, host: string, callback?: () => void) {
		this.socket.connect({ port, host, keepAlive: true }, callback);
		return this;
	}
}

//////////////////////////////
//////// Socket Options
//////////////////////////////
export interface SocketOptions {
	/**
	 * Maximum number of messages this socket can process before it is closed.
	 */
	maxMessages: number;

	/**
	 * Maximum amount of time (in milliseconds) that this socket can remain idle before it is closed.
	 * The timer resets on activity. If set to `0`, the idle timeout is disabled,
	 * allowing the socket to remain open indefinitely unless explicitly closed.
	 */
	idleTimeout: number;
}
