// Import Libs.
import { promises as Stream } from 'stream';
import net, { Socket as TcpSocket } from 'net';

// Import Local.
import { Mode, Parameters } from './rfi';
import Protocol, { Incoming, Outgoing } from './protocol';
import { Conductor } from './coordinator';

// Symbol Definitions.
const connections = Symbol('Connections');

/**
 * `Server` binds to an IP address and port number, listening for incoming SCP client connections.
 * Manages registered executions to handle various SCP modes and dispatches I/Os to the appropriate execution handlers.
 *
 * @emits `incoming` when a new incoming stream is received.
 * @emits `clientError` when an error occurs on the client connection.
 */
export default class Server extends net.Server implements IServer {
	/**
	 * Unique identifier of the server.
	 */
	public readonly identifier: string;

	/**
	 * Executions registered on the server.
	 */
	public readonly executions: Array<Execution>;

	/**
	 * Client socket connections.
	 */
	private readonly [connections]: Array<Connection>;

	/**
	 * Creates an instance of SCP `Server`.
	 *
	 * @param identifier unique identifier of the server.
	 */
	constructor(identifier: string) {
		super();

		// Initialize options.
		this.identifier = identifier;

		// Initialize variables.
		this.executions = new Array();
		this[connections] = new Array();

		// Bind listeners.
		this.onConnection = this.onConnection.bind(this);
		this.onIncoming = this.onIncoming.bind(this);

		// Add listeners.
		this.addListener('connection', this.onConnection);
		this.addListener('incoming', this.onIncoming);

		// Apply `Executor` properties. 👻
		Executor.applyProperties(this);
	}

	//////////////////////////////
	//////// Event Listeners
	//////////////////////////////
	/**
	 * @emits `incoming` when a new incoming stream is received.
	 * @emits `clientError` when an error occurs on the client connection.
	 */
	private onConnection(socket: TcpSocket) {
		const connection = new Connection(socket);
		connection.on('incoming', (incoming: ServerIncoming, outgoing: ServerOutgoing) => {
			this.emit('incoming', incoming, outgoing);
		});
		connection.on('error', (error: Error) => {
			this.emit('clientError', error, connection);
		});
		connection.on('close', () => {
			// Find the connection and remove it.
			const connectionIndex = this[connections].findIndex((c) => c === connection);
			if (connectionIndex >= 0) this[connections].splice(connectionIndex, 1);
		});
		this[connections].push(connection);
	}

	/**
	 * - Subscribe is handled by `subscribe` function.
	 * - Omni is handled by `dispatch` function.
	 */
	private onIncoming(incoming: ServerIncoming, outgoing: ServerOutgoing) {
		// Set: Outgoing.
		outgoing.parameters.SID = this.identifier;

		if (incoming.mode === 'SUBSCRIBE') {
			this.subscribe(incoming, outgoing);
		} else {
			// Set: Incoming.
			const operationRegExp = new RegExp(/^(?:(?<segment>[^.]+)\.)?(?<nexus>[^.]+)$/);
			const { groups } = operationRegExp.exec(incoming.operation) as RegExpExecArray;
			const { segment, nexus } = groups as { segment: string; nexus: string };
			incoming.segment = segment;
			incoming.nexus = nexus;
			incoming.matched = false;

			// Below line will blow your mind! 🤯
			this.dispatch(0, this.executions, incoming, outgoing, () => {});
		}
	}

	//////////////////////////////
	//////// Dispatch
	//////////////////////////////
	/**
	 * Recursively loop through the executions to find and execute its handler.
	 *
	 * @param executionIndex index of the current execution being processed.
	 * @param executions executions to be processed.
	 * @param incoming incoming stream.
	 * @param outgoing outgoing stream.
	 * @param unwind function called once the processed executions unwind.
	 */
	private dispatch(executionIndex: number, executions: Array<Execution>, incoming: ServerIncoming, outgoing: ServerOutgoing, unwind: () => void) {
		// Need I say more.
		if (executionIndex >= executions.length) return unwind();

		const execution = executions[executionIndex];

		// Shits about to go down! 😎
		if ('executions' in execution) {
			// Treat as `Segment`.
			const operationMatches = incoming.segment.match(execution.regExp);

			if (operationMatches) {
				// Segment found, Save match and process the segment.
				incoming.matched = true;

				// 🎢
				const unwindFunction = () => {
					incoming.matched = false;
					this.dispatch(executionIndex + 1, this.executions, incoming, outgoing, unwind);
				};
				this.dispatch(0, execution.executions, incoming, outgoing, unwindFunction);
				return;
			}
		} else {
			// Treat as `Nexus`.
			const modeMatches = incoming.mode === execution.mode || 'OMNI' === execution.mode;
			const segmentMatches = (incoming.segment && incoming.matched) || (!incoming.segment && !incoming.matched);
			const operationMatches = incoming.nexus.match(execution.regExp);

			if (modeMatches && segmentMatches && operationMatches) {
				// Nexus found, execute the handler. 🎉
				const proceedFunction = () => this.dispatch(executionIndex + 1, executions, incoming, outgoing, unwind);
				execution.handler(incoming, outgoing, proceedFunction);
				return;
			}
		}

		// Execution not found, lets keep going though the loop.
		this.dispatch(executionIndex + 1, executions, incoming, outgoing, unwind);
	}

	//////////////////////////////
	//////// Subscribe
	//////////////////////////////
	/**
	 * Registers a subscription from the client socket connection.
	 * Broadcasts are only sent to subscribed connections.
	 */
	private async subscribe(incoming: ServerIncoming, outgoing: ServerOutgoing) {
		try {
			// Read: Incoming stream.
			incoming.resume();
			await Stream.finished(incoming);

			// Set: Connection properties.
			incoming.scp.identifier = incoming.parameters.CID!;
			incoming.scp.canBroadcast = true;

			// Write: Outgoing stream.
			outgoing.end('');
			await Stream.finished(outgoing);
		} catch (error) {
			// ❗️⚠️❗️
			incoming.destroy();
			outgoing.destroy();
		}
	}

	//////////////////////////////
	//////// IServer
	//////////////////////////////
	public broadcast(operation: string, ...args: Array<any>) {
		const broadcasts = new Array<Promise<string>>();
		const outgoingData = JSON.stringify(args);
		for (const connection of this[connections]) {
			if (connection.canBroadcast) {
				const broadcast = new Promise<string>((resolve, reject) => {
					connection.createOutgoing('BROADCAST', operation, { SID: this.identifier }, async (outgoing) => {
						try {
							// Write: Outgoing stream.
							outgoing.end(outgoingData);
							await Stream.finished(outgoing);
							resolve(connection.identifier);
						} catch (error) {
							// ❗️⚠️❗️
							outgoing.destroy();
							reject(error);
						}
					});
				});
				broadcasts.push(broadcast);
			}
		}
		return Promise.all(broadcasts);
	}

	public attach(operation: string, executor: IExecutor) {
		const { executions } = executor;
		const regExp = new RegExp(`^${operation.replace(/\*/g, '.*')}$`);
		this.executions.push({ operation, regExp, executions } as Segment);
		return this;
	}

	//////////////////////////////
	//////// IExecutor
	//////////////////////////////
	declare public reply: <Returned>(operation: string, func: ReplyFunction<Returned>) => this;
	declare public conductor: (operation: string, func: ConductorFunction) => this;
	declare public omni: (operation: string, handler: IncomingHandler) => this;

	//////////////////////////////
	//////// Connection Management
	//////////////////////////////
	public close(callback?: (error?: Error) => void) {
		super.close(callback); // 🛑 🙉 to new connections.
		for (const connection of this[connections]) {
			connection.end(); // 🔚 ⏹️
		}
		return this;
	}
}

//////////////////////////////
//////// IServer
//////////////////////////////
/**
 * Interface for the SCP `Server`.
 */
export interface IServer extends IExecutor {
	/**
	 * Broadcasts the supplied to all subscribed client socket connections.
	 *
	 * Returns identifiers of client sockets to which the broadcast was sent.
	 * Receipt of the broadcast is not guaranteed.
	 *
	 * @param operation operation pattern.
	 * @param args arguments to broadcast.
	 */
	broadcast: (operation: string, ...args: Array<any>) => Promise<Array<string>>;

	/**
	 * Attaches a executor.
	 *
	 * @param operation operation pattern.
	 * @param executor executor to attach.
	 */
	attach: (operation: string, executor: IExecutor) => this;
}

//////////////////////////////
//////// Executor
//////////////////////////////
/**
 * Registers executions that handle SCP I/Os.
 * Once attached, SCP I/Os are dispatched to the appropriate registered executions.
 */
export class Executor implements IExecutor {
	/**
	 * Executions registered.
	 */
	public readonly executions: Array<Execution>;

	/**
	 * Creates an instance of `Executor`.
	 */
	constructor() {
		// Initialize variables.
		this.executions = new Array();

		// Apply `Executor` properties. 👻
		Executor.applyProperties(this);
	}

	//////////////////////////////
	//////// IExecutor
	//////////////////////////////
	declare public reply: <Returned>(operation: string, func: ReplyFunction<Returned>) => this;
	declare public conductor: (operation: string, func: ConductorFunction) => this;
	declare public omni: (operation: string, handler: IncomingHandler) => this;

	//////////////////////////////
	//////// Apply
	//////////////////////////////
	/**
	 * Applies properties of `IExecutor` interface to the provided instance,
	 * enabling registration of executions.
	 *
	 * @param instance instance to which the `IExecutor` properties are applied.
	 */
	public static applyProperties<I extends IExecutor>(instance: I) {
		instance.reply = (operation, func) => this.registerNexus(instance, 'REPLY', operation, this.replyHandler(func));
		instance.conductor = (operation, func) => this.registerNexus(instance, 'CONDUCTOR', operation, this.conductorHandler(func));
		instance.omni = (operation, handler) => this.registerNexus(instance, 'OMNI', operation, handler);
	}

	//////////////////////////////
	//////// Register
	//////////////////////////////
	/**
	 * Registers an individual SCP nexus for handling specific SCP mode and operation pattern.
	 *
	 * @param instance executor instance where the nexus will be registered.
	 * @param mode SCP mode of the nexus.
	 * @param operation operation pattern of the nexus.
	 * @param handler handler function of the nexus.
	 */
	private static registerNexus<I extends IExecutor>(instance: I, mode: Mode, operation: string, handler: IncomingHandler) {
		const regExp = new RegExp(`^${operation.replace(/\*/g, '.*')}$`);
		instance.executions.push({ mode, operation, regExp, handler } as Nexus);
		return instance;
	}

	//////////////////////////////
	//////// Handlers
	//////////////////////////////
	/**
	 * Creates a handler for executing reply function.
	 *
	 * @param func reply function to execute.
	 */
	private static replyHandler<Returned>(func: ReplyFunction<Returned>): IncomingHandler {
		return async (incoming, outgoing, proceed) => {
			let incomingData = new Array<Buffer>();
			let outgoingData = '';

			try {
				// Read: Incoming stream.
				for await (const chunk of incoming) {
					incomingData.push(chunk);
				}

				// Execute. 🤖
				try {
					const returned = await func(...JSON.parse(Buffer.concat(incomingData).toString()));
					outgoingData = returned !== undefined || null ? JSON.stringify(returned) : JSON.stringify({});
					outgoing.parameters.STATUS = 'OK';
				} catch (error) {
					error instanceof Error && delete error.stack; // Delete stack from error because we don't need it.
					outgoingData = JSON.stringify(error, Object.getOwnPropertyNames(error));
					outgoing.parameters.STATUS = 'ERROR';
				}

				// Write: Outgoing stream.
				outgoing.end(outgoingData);
				await Stream.finished(outgoing);
			} catch (error) {
				// ❗️⚠️❗️
				incoming.destroy();
				outgoing.destroy();
			}
		};
	}

	/**
	 * Creates a handler for executing conductor function.
	 *
	 * @param func conductor function to execute.
	 */
	private static conductorHandler(func: ConductorFunction): IncomingHandler {
		return async (incoming, outgoing, proceed) => {
			let incomingData = new Array<Buffer>();

			const conductor = new Conductor(incoming, outgoing); // 🎩🚦🔲
			try {
				// Read: Conductor.
				for await (const chunk of conductor) {
					incomingData.push(chunk as Buffer);
				}

				// Execute. 🤖
				func(conductor, ...JSON.parse(Buffer.concat(incomingData).toString()));

				// Write: Conductor.
				await conductor.flush(); // 🚽💨
			} catch (error) {
				// ❗️⚠️❗️
				conductor.destroy();
			}
		};
	}
}

//////////////////////////////
//////// IExecutor
//////////////////////////////
/**
 * Interface for the `Executor`.
 */
export interface IExecutor {
	/**
	 * Executions registered.
	 */
	executions: Array<Execution>;

	/**
	 * Registers a execution for handling REPLY I/O.
	 *
	 * Handler function receives a message from a client socket connection and returns a reply.
	 *
	 * @param operation operation pattern.
	 * @param func function to be executed.
	 */
	reply: <Returned>(operation: string, func: ReplyFunction<Returned>) => this;

	/**
	 * Registers a execution for handling CONDUCTOR I/O.
	 *
	 * Handler function receives a message from a client socket connection and coordinates signals.
	 *
	 * @param operation operation pattern.
	 * @param func function to be executed.
	 */
	conductor: (operation: string, func: ConductorFunction) => this;

	/**
	 * Registers a execution for handling OMNI I/O.
	 *
	 * @param operation operation pattern.
	 * @param handler incoming handler function.
	 */
	omni: (operation: string, handler: IncomingHandler) => this;
}

//////////////////////////////
//////// Execution
//////////////////////////////
/**
 * Union of `Segment` and `Nexus`.
 */
export type Execution = Segment | Nexus;

/**
 * Represents a group of executions.
 */
export interface Segment {
	/**
	 * Operation pattern of the segment.
	 */
	operation: string;

	/**
	 * Compiled regular expression to match operation pattern of the segment.
	 */
	regExp: RegExp;

	/**
	 * Executions registered in the segment.
	 */
	executions: Array<Nexus>;
}

/**
 * Represents a nexus.
 */
export interface Nexus {
	/**
	 * SCP mode of the nexus.
	 */
	mode: Mode;

	/**
	 * Operation pattern of the nexus.
	 */
	operation: string;

	/**
	 * Compiled regular expression to match operation pattern of the nexus.
	 */
	regExp: RegExp;

	/**
	 * Incoming handler function of the nexus.
	 */
	handler: IncomingHandler;
}

/**
 * Incoming handler.
 */
export type IncomingHandler = (incoming: ServerIncoming, outgoing: ServerOutgoing, proceed: ProceedFunction) => void;

/**
 * Proceed function.
 */
export type ProceedFunction = () => void;

/**
 * Reply function.
 */
export type ReplyFunction<Returned> = (...args: Array<any>) => Promise<Returned> | Returned;

/**
 * Conductor function.
 */
export type ConductorFunction = (conductor: Conductor, ...args: Array<any>) => Promise<void> | void;

//////////////////////////////
//////// Connection
//////////////////////////////
/**
 * Represents a client socket connection used by the SCP `Server`.
 *
 * @emits `incoming` when a new incoming stream is received.
 */
export class Connection extends Protocol {
	/**
	 * Unique identifier of the client socket connection.
	 */
	public identifier: string;

	/**
	 * `true` if the connection can accept broadcasts, `false` otherwise.
	 */
	public canBroadcast: boolean;

	/**
	 * RFI + outgoing callback queue.
	 */
	readonly #outgoingQueue: Array<{ mode: Mode; operation: string; parameters: Parameters; callback: (outgoing: ServerOutgoing) => void }>;

	/**
	 * Creates an instance of SCP `Connection`.
	 *
	 * @param socket underlying socket.
	 */
	constructor(socket: TcpSocket) {
		super(socket);

		// Initialize variables.
		this.identifier = 'unknown';
		this.canBroadcast = false;
		this.#outgoingQueue = new Array();

		// Add listeners.
		this.addListener('end', () => this.end());
		this.addListener('error', (error: Error) => this.destroy());

		// 🚴🏽💨
		this.cycleIO();
	}

	//////////////////////////////
	//////// Incoming/Outgoing
	//////////////////////////////
	/**
	 * Creates a new `Incoming` and `Outgoing` stream.
	 * Invoked recursively on the `close` event of the current outgoing stream to continuously listen for incoming streams.
	 *
	 * @emits `incoming` when a new incoming stream is received.
	 */
	private cycleIO() {
		const incoming = new ServerIncoming(this);
		incoming.once('rfi', () => {
			const outgoing = new ServerOutgoing(this);
			outgoing.setRFI(incoming.mode, incoming.operation);
			outgoing.once('close', () => this.cycleIO());
			this.emit('incoming', incoming, outgoing);
		});
	}

	/**
	 * Creates a new `Outgoing` stream.
	 *
	 * @param mode mode of the remote function.
	 * @param operation operation of the remote function.
	 * @param parameters parameters of the remote function.
	 * @param callback callback executed when the outgoing stream is ready.
	 */
	public createOutgoing(mode: Mode, operation: string, parameters: Parameters, callback: (outgoing: ServerOutgoing) => void) {
		// Push the RFI + outgoing callback into the queue.
		this.#outgoingQueue.push({ mode, operation, parameters, callback });

		// This is the first in the queue, let's execute it!
		if (this.#outgoingQueue.length === 1) {
			this.executeOutgoing();
		}

		return this;
	}

	/**
	 * Executes one outgoing callback at a time in FIFO manner.
	 * Invoked recursively on the `close` event of the current outgoing stream.
	 */
	private executeOutgoing() {
		// The first(0th) RFI + outgoing callback from the queue.
		const { mode, operation, parameters, callback: firstCallback } = this.#outgoingQueue[0];

		const outgoing = new ServerOutgoing(this);
		outgoing.setRFI(mode, operation, parameters);
		outgoing.once('close', () => {
			// Remove the first(0th) RFI + outgoing callback from the queue.
			this.#outgoingQueue.shift();

			// 🎡
			if (this.#outgoingQueue.length > 0) {
				this.executeOutgoing();
			}
		});

		// Let's execute the outgoing callback!
		firstCallback(outgoing);
	}
}

//////////////////////////////
//////// Incoming/Outgoing
//////////////////////////////
/**
 * Represents an SCP server incoming.
 */
export class ServerIncoming extends Incoming {
	/**
	 * Underlying SCP stream.
	 */
	declare public scp: Connection;

	/**
	 * Segment portion of the operation pattern.
	 */
	segment!: string;

	/**
	 * Nexus portion of the operation pattern.
	 */
	nexus!: string;

	/**
	 * `true` if the segment matched, `false` otherwise.
	 */
	matched!: boolean;
}

/**
 * Represents an SCP server outgoing.
 */
export class ServerOutgoing extends Outgoing {
	/**
	 * Underlying SCP stream.
	 */
	declare public scp: Connection;
}
