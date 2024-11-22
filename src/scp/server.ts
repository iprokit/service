// Import Libs.
import { promises as Stream } from 'stream';

// Import @iprolab Libs.
import SCP from '@iprolab/scp';

// Import Local.
import { RFI, Incoming, Outgoing } from './definitions';
import { Conductor } from './orchestrator';

/**
 * `Server` binds to an IP address and port number, listening for incoming SCP client connections.
 * Manages registered executions to handle various SCP modes and dispatches I/Os to the appropriate execution handlers.
 *
 * @emits `listening` when the server is bound after calling `server.listen()`.
 * @emits `connection` when a client socket connection is received.
 * @emits `error` when an error occurs.
 * @emits `drop` when the number of connections reaches the `server.maxConnections` threshold.
 * @emits `close` when the server is fully closed.
 */
export default class Server extends SCP.Server implements IServer {
    /**
     * Unique identifier of the server.
     */
    public readonly identifier: string;

    /**
     * Client socket connections.
     */
    public declare readonly connections: Array<Connection>;

    /**
     * Executions registered on the server.
     */
    public readonly executions: Array<Execution>;

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

        // Bind listeners.
        this.onIncoming = this.onIncoming.bind(this);

        // Add listeners.
        this.addListener('incoming', this.onIncoming);

        // Apply `Executor` properties. 👻
        Executor.applyProperties(this);
    }

    //////////////////////////////
    //////// Event Listeners
    //////////////////////////////
    /**
     * - Subscribe is handled by `subscribe` function.
     * - Omni is handled by `dispatch` function.
     */
    private onIncoming(incoming: ServerIncoming, outgoing: ServerOutgoing) {
        // Set: Outgoing.
        outgoing.parameters['SID'] = this.identifier;

        if (incoming.mode === 'SUBSCRIBE') {
            this.subscribe(incoming, outgoing);
        } else if (incoming.mode === 'OMNI') {
            // Set: Incoming.
            const operationRegExp = new RegExp(/^(?:(?<segment>[^.]+)\.)?(?<nexus>[^.]+)$/);
            const { groups } = operationRegExp.exec(incoming.operation) as RegExpExecArray;
            const { segment, nexus } = groups as { segment: string, nexus: string };
            incoming.segment = segment;
            incoming.nexus = nexus;
            incoming.matched = false;

            // Below line will blow your mind! 🤯
            this.dispatch(0, this.executions, incoming, outgoing, () => { });
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
                }
                this.dispatch(0, execution.executions, incoming, outgoing, unwindFunction);
                return;
            }
        } else {
            // Treat as `Nexus`.
            const segmentMatches = (incoming.segment && incoming.matched) || (!incoming.segment && !incoming.matched);
            const operationMatches = incoming.nexus.match(execution.regExp);

            if (segmentMatches && operationMatches) {
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
            incoming.socket.identifier = incoming.parameters['CID']!;
            incoming.socket.canBroadcast = true;

            // Write: Outgoing stream.
            outgoing.end('');
            await Stream.finished(outgoing);
        } catch (error) {
            // ❗️⚠️❗️
            incoming.destroy();
            outgoing.destroy();
            outgoing.socket.destroy(error as Error);
        }
    }

    //////////////////////////////
    //////// IServer
    //////////////////////////////
    public broadcast(operation: string, ...args: Array<any>) {
        const broadcasts = new Array<Promise<string>>();
        for (const connection of this.connections) {
            if (connection.canBroadcast) {
                const broadcast = new Promise<string>(async (resolve, reject) => {
                    connection.createOutgoing(async (outgoing) => {
                        try {
                            outgoing.setRFI(new RFI('BROADCAST', operation, { 'SID': this.identifier, 'FORMAT': 'OBJECT' }));
                            outgoing.end(JSON.stringify(args));
                            await Stream.finished(outgoing);
                            resolve(connection.identifier);
                        } catch (error) {
                            // ❗️⚠️❗️
                            outgoing.destroy();
                            outgoing.socket.destroy(error as Error);
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
    public declare omni: (operation: string, handler: IncomingHandler) => this;
    public declare func: <Returned>(operation: string, func: Function<Returned>) => this;
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
     * Returns identifiers of client sockets that successfully received broadcast.
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
    public declare omni: (operation: string, handler: IncomingHandler) => this;
    public declare func: <Returned>(operation: string, func: Function<Returned>) => this;

    //////////////////////////////
    //////// Factory
    //////////////////////////////
    /**
     * Applies properties of `IExecutor` interface to the provided instance,
     * enabling registration of executions.
     * 
     * @param instance instance to which the `IExecutor` properties are applied.
     */
    public static applyProperties<I extends IExecutor>(instance: I) {
        // `IExecutor` properties. 😈
        instance.omni = (operation, handler) => {
            const regExp = new RegExp(`^${operation.replace(/\*/g, '.*')}$`);
            instance.executions.push({ operation, regExp, handler } as Nexus);
            return instance;
        }
        instance.func = (operation, func) => {
            instance.omni(operation, async (incoming, outgoing, proceed) => {
                if (incoming.parameters['FORMAT'] !== 'OBJECT') return proceed(); // 🤦🏽‍♂️

                // Initialize. 🎩🚦🔲
                const conductor = (incoming.parameters['CONDUCTOR'] === 'TRUE') ? new Conductor(incoming, outgoing) : undefined;
                let incomingData = '', outgoingData = '';
                try {
                    // Read.
                    // NOOOO..Waiting for RFI...🕵️‍♂️
                    for await (const chunk of (conductor ?? incoming)) {
                        incomingData += chunk;
                    }
                    conductor || await Stream.finished(incoming);

                    // Execute. 🤖
                    try {
                        const args = (conductor) ? [...JSON.parse(incomingData), conductor] : [...JSON.parse(incomingData)];
                        const returned = await func(...args);
                        outgoingData = (returned !== undefined || null) ? JSON.stringify(returned) : JSON.stringify({});
                        outgoing.parameters['STATUS'] = 'OK';
                    } catch (error) {
                        error instanceof Error && delete error.stack; // Delete stack from error because we dont need it.
                        outgoingData = JSON.stringify(error, Object.getOwnPropertyNames(error));
                        outgoing.parameters['STATUS'] = 'ERROR';
                    }

                    // Write.
                    conductor ? await conductor.deliver(outgoingData) : await Stream.finished(outgoing.end(outgoingData));
                } catch (error) {
                    // ❗️⚠️❗️
                    incoming.destroy();
                    outgoing.destroy();
                }
            });
            return instance;
        }
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
     * Registers a execution for handling OMNI I/O.
     * 
     * @param operation operation pattern.
     * @param handler incoming handler function.
     */
    omni: (operation: string, handler: IncomingHandler) => this;

    /**
     * Registers a asynchronous function for execution through a client socket connection.
     * 
     * @param operation operation pattern.
     * @param func function to be executed.
     */
    func: <Returned>(operation: string, func: Function<Returned>) => this;
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
 * Remote function.
 */
export type Function<Returned> = (...args: Array<any>) => Promise<Returned> | Returned;

//////////////////////////////
//////// Connection
//////////////////////////////
export interface Connection extends InstanceType<typeof SCP.Connection> {
    /**
     * Unique identifier of the client socket connection.
     */
    identifier: string;

    /**
     * `true` if the connection can accept broadcasts, `false` otherwise.
     */
    canBroadcast: boolean;

    /**
     * Current incoming stream.
     */
    incoming: ServerIncoming;

    /**
     * Current outgoing stream.
     */
    outgoing: ServerOutgoing;
}

//////////////////////////////
//////// Incoming/Outgoing
//////////////////////////////
/**
 * Represents an SCP server incoming.
 */
export interface ServerIncoming extends Incoming {
    /**
     * Underlying SCP Socket.
     */
    socket: Connection;

    /**
     * Segment portion of the operation pattern.
     */
    segment: string;

    /**
     * Nexus portion of the operation pattern.
     */
    nexus: string;

    /**
     * `true` if the segment matched, `false` otherwise.
     */
    matched: boolean;
}

/**
 * Represents an SCP server outgoing.
 */
export interface ServerOutgoing extends Outgoing {
    /**
     * Underlying SCP Socket.
     */
    socket: Connection;
}