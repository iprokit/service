//Import Libs.
import Stream from 'stream';

//Import @iprotechs Libs.
import { RFI, Incoming, Outgoing, Server, Connection } from '@iprotechs/scp';

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
    public readonly connections: Array<ScpConnection>;

    /**
     * The remotes registered on the server.
     */
    public readonly remotes: Array<Remote>;

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
        this.remotes = new Array();

        //Bind listeners.
        this.onIncoming = this.onIncoming.bind(this);

        //Add listeners.
        this.addListener('incoming', this.onIncoming);

        //Apply `Receiver` properties 👻.
        this.applyReceiverProperties(this);
    }

    //////////////////////////////
    //////Event Listeners
    //////////////////////////////
    /**
     * - Subscribe is handled by `subscribe` function.
     * - [Mode?] is handled by `transport` function.
     */
    private onIncoming(incoming: Incoming, outgoing: Outgoing) {
        //Set: Outgoing.
        outgoing.set('SID', this.identifier);

        //Handle Subscribe.
        if (incoming.mode === 'SUBSCRIBE' && incoming.operation === 'subscribe') {
            this.subscribe(incoming, outgoing);
            return;
        }

        //Below line will blow your mind! 🤯
        this.dispatch(0, false, this.remotes, incoming, outgoing, () => { });
    }

    //////////////////////////////
    //////Dispatch
    //////////////////////////////
    /**
     * Recursively loop through the remotes to find and execute its handler.
     * 
     * @param remoteIndex the index of the current remote being processed.
     * @param classMatched set to true if the class matched, false otherwise.
     * @param remotes the remotes to be processed.
     * @param incoming the incoming stream.
     * @param outgoing the outgoing stream.
     * @param unwind function called once the processed remotes unwind.
     */
    private dispatch(remoteIndex: number, classMatched: boolean, remotes: Array<Remote>, incoming: Incoming, outgoing: Outgoing, unwind: () => void) {
        //Need I say more.
        if (remoteIndex >= remotes.length) return unwind();

        const remote = remotes[remoteIndex];
        const regExp = new RegExp(/^(?:(?<className>[^.]+)\.)?(?<functionName>[^.]+)$/);
        const { className, functionName } = regExp.exec(incoming.operation).groups;

        //Shits about to go down! 😎
        if ('functions' in remote) {
            const remoteClass = remote as RemoteClass;
            const operationMatches = className.match(remoteClass.regExp);

            if (operationMatches) {
                //Remote class found, process the class. 🎢
                const unwindFunction = () => this.dispatch(remoteIndex + 1, false, this.remotes, incoming, outgoing, unwind);
                this.dispatch(0, true, remoteClass.functions, incoming, outgoing, unwindFunction);
                return;
            }
        } else {
            const remoteFunction = remote as RemoteFunction;
            const modeMatches = incoming.mode === remoteFunction.mode || 'ALL' === remoteFunction.mode;
            const classMatches = (className && classMatched) || (!className && !classMatched);
            const operationMatches = functionName.match(remoteFunction.regExp);

            if (modeMatches && classMatches && operationMatches) {
                //Remote function found, execute the handler. 🎉
                const proceedFunction = () => this.dispatch(remoteIndex + 1, classMatched, remotes, incoming, outgoing, unwind);
                remoteFunction.handler(incoming, outgoing, proceedFunction);
                return;
            }
        }

        //Remote not found, lets keep going though the loop.
        this.dispatch(remoteIndex + 1, classMatched, remotes, incoming, outgoing, unwind);
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
        (incoming.socket as ScpConnection).identifier = incoming.get('CID');

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

    public Remote() {
        const receiver = { remotes: new Array<Remote>() } as Receiver;

        //Apply `Receiver` properties 👻.
        this.applyReceiverProperties(receiver);
        return receiver;
    }

    public attach(operation: string, receiver: Receiver) {
        const { remotes: functions } = receiver;
        const regExp = new RegExp(`^${operation.replace(/\*/g, '.*')}$`);
        this.remotes.push({ operation, regExp, functions } as RemoteClass);
        return this;
    }

    //////////////////////////////
    //////Interface: Receiver
    //////////////////////////////
    public reply: (operation: string, handler: IncomingHandler) => this;

    //////////////////////////////
    //////Factory: Receiver
    //////////////////////////////
    /**
     * Applies properties of the `Receiver` interface to the provided instance,
     * enabling the registration of remotes.
     * 
     * @param instance the instance to which the `Receiver` properties are applied.
     */
    private applyReceiverProperties<I extends Receiver>(instance: I) {
        //Factory for registering a `RemoteFunction`.
        const remoteFunction = (mode: ScpMode) => {
            return (operation: string, handler: IncomingHandler) => {
                const regExp = new RegExp(`^${operation.replace(/\*/g, '.*')}$`);
                instance.remotes.push({ mode, operation, regExp, handler } as RemoteFunction);
                return instance;
            }
        }

        //`Receiver` properties 😈.
        instance.reply = remoteFunction('REPLY');
    }
}

//////////////////////////////
/////IScpServer
//////////////////////////////
/**
 * Interface of `ScpServer`.
 */
export interface IScpServer extends Receiver {
    /**
     * Broadcasts the supplied to all the subscribed client socket connections.
     * 
     * @param operation the operation pattern.
     * @param data the data to broadcast.
     * @param params the optional input/output parameters of the broadcast.
     */
    broadcast: (operation: string, data: string, params?: Iterable<readonly [string, string]>) => this;

    /**
     * Returns a `Receiver` to group remote functions that share related functionality.
     */
    Remote: () => Receiver;

    /**
     * Attaches a receiver.
     * 
     * @param operation the operation pattern.
     * @param receiver the receiver to attach.
     */
    attach: (operation: string, receiver: Receiver) => this;
}

//////////////////////////////
//////Receiver
//////////////////////////////
/**
 * Interface for handling SCP I/O and registering remotes.
 */
export interface Receiver {
    /**
     * The remotes registered.
     */
    remotes: Array<Remote>;

    /**
     * Registers a remote function for handling REPLY I/O.
     * 
     * @param operation the operation pattern.
     * @param handler the incoming handler function.
     */
    reply: (operation: string, handler: IncomingHandler) => this;
}

//////////////////////////////
//////Remote
//////////////////////////////
/**
 * The union of an `RemoteClass`/`RemoteFunction`.
 */
export type Remote = RemoteClass | RemoteFunction;

/**
 * Represents a group of remote functions that share related functionality.
 */
export interface RemoteClass {
    /**
     * The operation pattern of the remote class.
     */
    operation: string;

    /**
     * The compiled regular expression to match the operation of the remote class.
     */
    regExp: RegExp;

    /**
     * The remote functions registered.
     */
    functions: Array<RemoteFunction>;
}

/**
 * Represents a remote function.
 */
export interface RemoteFunction {
    /**
     * The SCP mode of the remote function.
     */
    mode: ScpMode;

    /**
     * The operation pattern of the remote function.
     */
    operation: string;

    /**
     * The compiled regular expression to match the operation of the remote function.
     */
    regExp: RegExp;

    /**
     * The incoming handler of the remote function.
     */
    handler: IncomingHandler;
}

/**
 * The SCP mode.
 */
export type ScpMode = 'REPLY' | 'ALL';

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
export interface ScpConnection extends Connection {
    /**
     * The unique identifier of the client socket connection.
     */
    identifier: string;
}