//Import Libs.
import { promises as Stream } from 'stream';

//Import @iprolab Libs.
import SCP, { RFI, Server as ScpServer } from '@iprolab/scp';

//Import Local.
import Conductor from './scp.conductor';

/**
 * This class is used to create a SCP server.
 * A `Server` is bound to an IP address and port number and listens for incoming SCP client connections.
 *
 * @emits `listening` when the server has been bound after calling `server.listen()`.
 * @emits `connection` when a client socket connection is received.
 * @emits `error` when an error occurs.
 * @emits `drop` when the number of connections reaches the threshold of `server.maxConnections`.
 * @emits `close` when the server is fully closed.
 */
export default class Server extends ScpServer implements IServer {
    /**
     * The unique identifier of the server.
     */
    public readonly identifier: string;

    /**
     * The client socket connections.
     */
    public declare readonly connections: Array<Connection>;

    /**
     * The executions registered on the server.
     */
    public readonly executions: Array<Execution>;

    /**
     * Creates an instance of SCP server.
     * 
     * @param identifier the unique identifier of the server.
     */
    constructor(identifier: string) {
        super();

        //Initialize Options.
        this.identifier = identifier;

        //Initialize Variables.
        this.executions = new Array();

        //Bind listeners.
        this.onIncoming = this.onIncoming.bind(this);

        //Add listeners.
        this.addListener('incoming', this.onIncoming);

        //Apply `Executor` properties 👻.
        Executor.applyProperties(this);
    }

    //////////////////////////////
    //////Event Listeners
    //////////////////////////////
    /**
     * - Subscribe is handled by `subscribe` function.
     * - Omni is handled by `dispatch` function.
     */
    private onIncoming(incoming: Incoming, outgoing: Outgoing) {
        //Set: Outgoing.
        outgoing.set('SID', this.identifier);

        if (incoming.mode === 'SUBSCRIBE' && incoming.operation === 'subscribe') {
            this.subscribe(incoming, outgoing);
        }
        if (incoming.mode === 'OMNI') {
            //Set: Incoming.
            const operationRegExp = new RegExp(/^(?:(?<segment>[^.]+)\.)?(?<nexus>[^.]+)$/);
            const { groups } = operationRegExp.exec(incoming.operation) as RegExpExecArray;
            const { segment, nexus } = groups as { segment: string, nexus: string };
            incoming.segment = segment;
            incoming.nexus = nexus;
            incoming.matched = false;

            //Below line will blow your mind! 🤯
            this.dispatch(0, this.executions, incoming, outgoing, () => { });
        }
    }

    //////////////////////////////
    //////Dispatch
    //////////////////////////////
    /**
     * Recursively loop through the executions to find and execute its handler.
     * 
     * @param executionIndex the index of the current execution being processed.
     * @param executions the executions to be processed.
     * @param incoming the incoming stream.
     * @param outgoing the outgoing stream.
     * @param unwind function called once the processed executions unwind.
     */
    private dispatch(executionIndex: number, executions: Array<Execution>, incoming: Incoming, outgoing: Outgoing, unwind: () => void) {
        //Need I say more.
        if (executionIndex >= executions.length) return unwind();

        const execution = executions[executionIndex];

        //Shits about to go down! 😎
        if ('executions' in execution) {
            //Treat as `Segment`.
            const operationMatches = incoming.segment.match(execution.regExp);

            if (operationMatches) {
                //Segment found, Save match and process the segment.
                incoming.matched = true;

                //🎢
                const unwindFunction = () => {
                    incoming.matched = false;
                    this.dispatch(executionIndex + 1, this.executions, incoming, outgoing, unwind);
                }
                this.dispatch(0, execution.executions, incoming, outgoing, unwindFunction);
                return;
            }
        } else {
            //Treat as `Nexus`.
            const segmentMatches = (incoming.segment && incoming.matched) || (!incoming.segment && !incoming.matched);
            const operationMatches = incoming.nexus.match(execution.regExp);

            if (segmentMatches && operationMatches) {
                //Nexus found, execute the handler. 🎉
                const proceedFunction = () => this.dispatch(executionIndex + 1, executions, incoming, outgoing, unwind);
                execution.handler(incoming, outgoing, proceedFunction);
                return;
            }
        }

        //Execution not found, lets keep going though the loop.
        this.dispatch(executionIndex + 1, executions, incoming, outgoing, unwind);
    }

    //////////////////////////////
    //////Subscribe
    //////////////////////////////
    /**
     * Registers the subscription from the client socket connection.
     * Broadcasts can only be sent to subscribed connections.
     */
    private async subscribe(incoming: Incoming, outgoing: Outgoing) {
        try {
            //Read: Incoming stream.
            incoming.resume();
            await Stream.finished(incoming);

            //Set: Connection properties.
            incoming.socket.identifier = incoming.get('CID') as string;

            //Write: Outgoing stream.
            outgoing.end('');
            await Stream.finished(outgoing);
        } catch (error) {
            //❗️⚠️❗️
            incoming.destroy();
            outgoing.destroy();
            outgoing.socket.destroy(error as Error);
        }
    }

    //////////////////////////////
    //////Interface: IServer
    //////////////////////////////
    public broadcast(operation: string, ...args: Array<any>) {
        return Promise.all(
            this.connections
                .filter((connection) => !!connection.identifier)
                .map((connection) =>
                    new Promise<string>((resolve, reject) =>
                        connection.createOutgoing(async (outgoing) => {
                            try {
                                outgoing.setRFI(new RFI('BROADCAST', operation, [['FORMAT', 'OBJECT']]));
                                outgoing.set('SID', this.identifier);
                                outgoing.end(JSON.stringify(args));
                                await Stream.finished(outgoing);
                                resolve(connection.identifier);
                            } catch (error) {
                                //❗️⚠️❗️
                                outgoing.destroy();
                                outgoing.socket.destroy(error as Error);
                                reject(error);
                            }
                        })
                    )
                )
        );
    }

    public attach(operation: string, executor: IExecutor) {
        const { executions } = executor;
        const regExp = new RegExp(`^${operation.replace(/\*/g, '.*')}$`);
        this.executions.push({ operation, regExp, executions } as Segment);
        return this;
    }

    //////////////////////////////
    //////Interface: IExecutor
    //////////////////////////////
    public declare omni: (operation: string, handler: IncomingHandler) => this;
    public declare func: <Returned>(operation: string, func: Function<Returned>) => this;
}

//////////////////////////////
/////IServer
//////////////////////////////
/**
 * Interface of SCP `Server`.
 */
export interface IServer extends IExecutor {
    /**
     * Broadcasts the supplied to all subscribed client socket connections.
     * Returns the identifiers of the client sockets that successfully received the broadcast.
     * 
     * @param operation the operation pattern.
     * @param args the arguments to broadcast.
     */
    broadcast: (operation: string, ...args: Array<any>) => Promise<Array<string>>;

    /**
     * Attaches a executor.
     * 
     * @param operation the operation pattern.
     * @param executor the executor to attach.
     */
    attach: (operation: string, executor: IExecutor) => this;
}

//////////////////////////////
//////Executor
//////////////////////////////
/**
 * This class is used to register executions that handle SCP I/O's.
 * Once attached, SCP I/O's are dispatched to the appropriate registered executions.
 */
export class Executor implements IExecutor {
    /**
     * The executions registered.
     */
    public readonly executions: Array<Execution>;

    /**
     * Creates an instance of executor.
     */
    constructor() {
        //Initialize Variables.
        this.executions = new Array();

        //Apply `Executor` properties 👻.
        Executor.applyProperties(this);
    }

    //////////////////////////////
    //////Interface: IExecutor
    //////////////////////////////
    public declare omni: (operation: string, handler: IncomingHandler) => this;
    public declare func: <Returned>(operation: string, func: Function<Returned>) => this;

    //////////////////////////////
    //////Factory
    //////////////////////////////
    /**
     * Applies properties of the `IExecutor` interface to the provided instance,
     * enabling the registration of executions.
     * 
     * @param instance the instance to which the `IExecutor` properties are applied.
     */
    public static applyProperties<I extends IExecutor>(instance: I) {
        //`IExecutor` properties 😈.
        instance.omni = (operation, handler) => {
            const regExp = new RegExp(`^${operation.replace(/\*/g, '.*')}$`);
            instance.executions.push({ operation, regExp, handler } as Nexus);
            return instance;
        }
        instance.func = (operation, func) => {
            instance.omni(operation, async (incoming, outgoing, proceed) => {
                if (incoming.get('FORMAT') !== 'OBJECT') return proceed(); //🤦🏽‍♂️

                //Initialize 🎩🚦🔲.
                const conductor = (incoming.has('CONDUCTOR')) ? new Conductor() : undefined;
                if (conductor) {
                    conductor.assign(incoming, outgoing);
                }

                let incomingData = '', outgoingData = '';
                try {
                    //Read.
                    for await (const chunk of (conductor ?? incoming)) {
                        incomingData += chunk;
                    }

                    //Execute 🫡.
                    try {
                        const args = (conductor) ? [...JSON.parse(incomingData), conductor] : [...JSON.parse(incomingData)];
                        const returned = await func(...args);
                        outgoingData = (returned !== undefined || null) ? JSON.stringify(returned) : JSON.stringify({});
                        outgoing.set('STATUS', 'OK');
                    } catch (error) {
                        error instanceof Error && delete error.stack; /* Delete stack from error because we dont need it. */
                        outgoingData = JSON.stringify(error, Object.getOwnPropertyNames(error));
                        outgoing.set('STATUS', 'ERROR');
                    }

                    //Write.
                    await (conductor ? conductor.writeBlock(outgoingData) : Stream.finished(outgoing.end(outgoingData)));
                } catch (error) {
                    //❗️⚠️❗️
                    incoming.destroy();
                    outgoing.destroy();
                }
            });
            return instance;
        }
    }
}

//////////////////////////////
//////IExecutor
//////////////////////////////
/**
 * Interface of `Executor`.
 */
export interface IExecutor {
    /**
     * The executions registered.
     */
    executions: Array<Execution>;

    /**
     * Registers a execution for handling OMNI I/O.
     * 
     * @param operation the operation pattern.
     * @param handler the incoming handler function.
     */
    omni: (operation: string, handler: IncomingHandler) => this;

    /**
     * Registers a function for execution through a client socket connection.
     * 
     * @param operation the operation pattern.
     * @param func the function to be executed.
     */
    func: <Returned>(operation: string, func: Function<Returned>) => this;
}

//////////////////////////////
//////Execution
//////////////////////////////
/**
 * The union of an `Segment`/`Nexus`.
 */
export type Execution = Segment | Nexus;

/**
 * Represents a group of executions.
 */
export interface Segment {
    /**
     * The operation pattern of the segment.
     */
    operation: string;

    /**
     * The compiled regular expression to match the operation of the segment.
     */
    regExp: RegExp;

    /**
     * The executions registered in the segment.
     */
    executions: Array<Nexus>;
}

/**
 * Represents a nexus.
 */
export interface Nexus {
    /**
     * The operation pattern of the nexus.
     */
    operation: string;

    /**
     * The compiled regular expression to match the operation of the nexus.
     */
    regExp: RegExp;

    /**
     * The incoming handler function of the nexus.
     */
    handler: IncomingHandler;
}

/**
 * The incoming handler.
 */
export type IncomingHandler = (incoming: Incoming, outgoing: Outgoing, proceed: ProceedFunction) => void;

/**
 * The proceed function.
 */
export type ProceedFunction = () => void;

/**
 * The remote function.
 */
export type Function<Returned> = (...args: Array<any>) => Promise<Returned> | Returned;

//////////////////////////////
//////Connection
//////////////////////////////
export interface Connection extends SCP.Connection {
    /**
     * The unique identifier of the client socket connection.
     */
    identifier: string;

    /**
     * The current incoming stream.
     */
    incoming: Incoming;

    /**
     * The current outgoing stream.
     */
    outgoing: Outgoing;
}

//////////////////////////////
/////Incoming/Outgoing
//////////////////////////////
/**
 * Represents an incoming SCP.
 */
export interface Incoming extends SCP.Incoming {
    /**
     * The underlying SCP Socket.
     */
    socket: Connection;

    /**
     * The segment portion of the operation pattern.
     */
    segment: string;

    /**
     * The nexus portion of the operation pattern.
     */
    nexus: string;

    /**
     * Set to true if the segment matched, false otherwise.
     */
    matched: boolean;
}

/**
 * Represents an outgoing SCP.
 */
export interface Outgoing extends SCP.Outgoing {
    /**
     * The underlying SCP Socket.
     */
    socket: Connection;
}