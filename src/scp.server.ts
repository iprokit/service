//Import Libs.
import Stream from 'stream';

//Import @iprotechs Libs.
import SCP, { RFI, Server } from '@iprotechs/scp';

/**
 * This class is used to create a SCP server.
 * A `ScpServer` is bound to an IP address and port number and listens for incoming SCP client connections.
 *
 * @emits `listening` when the server has been bound after calling `server.listen()`.
 * @emits `connection` when a client socket connection is received.
 * @emits `error` when an error occurs.
 * @emits `drop` when the number of connections reaches the threshold of `server.maxConnections`.
 * @emits `close` when the server is fully closed.
 */
export default class ScpServer extends Server implements IScpServer {
    /**
     * The unique identifier of the server.
     */
    public readonly identifier: string;

    /**
     * The client socket connections.
     */
    public readonly connections: Array<Connection>;

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
        this.applyExecutorProperties(this);
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
            const regExp = new RegExp(/^(?:(?<segment>[^.]+)\.)?(?<nexus>[^.]+)$/);
            const { segment, nexus } = regExp.exec(incoming.operation).groups;
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
    private subscribe(incoming: Incoming, outgoing: Outgoing) {
        //Read: Incoming stream.
        Stream.finished(incoming, (error) => { /* LIFE HAPPENS!!! */ });
        incoming.resume();

        //Set: Connection properties.
        incoming.socket.identifier = incoming.get('CID');

        //Write: Outgoing stream.
        Stream.finished(outgoing, (error) => { /* LIFE HAPPENS!!! */ });
        outgoing.end('');
    }

    //////////////////////////////
    //////Interface: ScpServer
    //////////////////////////////
    public broadcast(operation: string, data: string, params?: Iterable<readonly [string, string]>) {
        for (const connection of this.connections) {
            if (!connection.identifier) continue;

            connection.createOutgoing((outgoing: Outgoing) => {
                Stream.finished(outgoing, (error) => { /* LIFE HAPPENS!!! */ });
                outgoing.setRFI(new RFI('BROADCAST', operation, params));
                outgoing.set('SID', this.identifier);
                outgoing.end(data);
            });
        }
        return this;
    }

    public Execution() {
        const executor = { executions: new Array<Execution>() } as Executor;

        //Apply `Executor` properties 👻.
        this.applyExecutorProperties(executor);
        return executor;
    }

    public attach(operation: string, executor: Executor) {
        const { executions } = executor;
        const regExp = new RegExp(`^${operation.replace(/\*/g, '.*')}$`);
        this.executions.push({ operation, regExp, executions } as Segment);
        return this;
    }

    //////////////////////////////
    //////Interface: Executor
    //////////////////////////////
    public omni: (operation: string, handler: IncomingHandler) => this;

    //////////////////////////////
    //////Factory: Executor
    //////////////////////////////
    /**
     * Applies properties of the `Executor` interface to the provided instance,
     * enabling the registration of executions.
     * 
     * @param instance the instance to which the `Executor` properties are applied.
     */
    private applyExecutorProperties<I extends Executor>(instance: I) {
        //`Executor` properties 😈.
        instance.omni = (operation: string, handler: IncomingHandler) => {
            const regExp = new RegExp(`^${operation.replace(/\*/g, '.*')}$`);
            instance.executions.push({ operation, regExp, handler } as Nexus);
            return instance;
        }
    }
}

//////////////////////////////
/////IScpServer
//////////////////////////////
/**
 * Interface of `ScpServer`.
 */
export interface IScpServer extends Executor {
    /**
     * Broadcasts data to all the subscribed client socket connections.
     * 
     * @param operation the operation pattern.
     * @param data the data to broadcast.
     * @param params the optional input/output parameters of the broadcast.
     */
    broadcast: (operation: string, data: string, params?: Iterable<readonly [string, string]>) => this;

    /**
     * Returns a `Executor` to group executions that share related functionality.
     */
    Execution: () => Executor;

    /**
     * Attaches a executor.
     * 
     * @param operation the operation pattern.
     * @param executor the executor to attach.
     */
    attach: (operation: string, executor: Executor) => this;
}

//////////////////////////////
//////Executor
//////////////////////////////
/**
 * Interface for handling SCP I/O's and registering executions.
 */
export interface Executor {
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
}

//////////////////////////////
//////Execution
//////////////////////////////
/**
 * The union of an `Segment`/`Nexus`.
 */
export type Execution = Segment | Nexus;

/**
 * Represents a group of executions that share related functionality.
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