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
export default class ScpServer extends Server {
    /**
     * The unique identifier of the server.
     */
    public readonly identifier: string;

    /**
     * The client socket connections.
     */
    public readonly connections: Array<ScpConnection>;

    /**
     * The remote classes registered on the server.
     */
    public readonly remoteClasses: Array<RemoteClass>;

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
        this.remoteClasses = new Array();

        //Bind listeners.
        this.onIncoming = this.onIncoming.bind(this);

        //Add listeners.
        this.addListener('incoming', this.onIncoming);
    }

    //////////////////////////////
    //////Event Listeners
    //////////////////////////////
    /**
     * - Subscribe is handled by `subscribe` function.
     * - [Mode?] is handled by `transport` function.
     */
    private onIncoming(incoming: Incoming, outgoing: Outgoing) {
        //Set: Outgoing params.
        outgoing.set('SID', this.identifier);

        //Handle Subscribe.
        if (incoming.mode === 'SUBSCRIBE' && incoming.operation === 'SCP.subscribe') {
            this.subscribe(incoming, outgoing);
            return;
        }

        //Below line will blow your mind! 🤯
        this.transport(0, 0, incoming, outgoing);
    }

    //////////////////////////////
    //////Transport
    //////////////////////////////
    /**
     * Recursively loop through the remote classes to find and execute its handler.
     * 
     * @param classIndex the index of the current remote class being processed.
     * @param functionIndex the index of the current remote function being processed.
     * @param incoming the incoming stream.
     * @param outgoing the outgoing stream.
     */
    private transport(classIndex: number, functionIndex: number, incoming: Incoming, outgoing: Outgoing) {
        //Need I say more.
        if (classIndex >= this.remoteClasses.length) return;

        const remoteClass = this.remoteClasses[classIndex];
        const remoteFunction = remoteClass.remoteFunctions[functionIndex++];

        if (!remoteFunction) {
            //Class not found, process the next class.
            this.transport(classIndex + 1, 0, incoming, outgoing);
            return;
        }

        //Shits about to go down! 😎
        const mode = (remoteFunction.mode === incoming.mode || remoteFunction.mode === 'ALL') ? true : false;
        const className = (remoteClass.name === incoming.rfi.className || remoteClass.name === '*') ? true : false;
        const functionName = (remoteFunction.name === incoming.rfi.functionName || remoteFunction.name === '*') ? true : false;

        if (mode && className && functionName) {
            //Function found, lets execute the handler.
            const proceed: ProceedFunction = () => this.transport(classIndex, functionIndex, incoming, outgoing);
            remoteFunction.handler(incoming, outgoing, proceed);
        } else {
            //Function not found, process the next function.
            this.transport(classIndex, functionIndex, incoming, outgoing);
        }
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
    //////Broadcast
    //////////////////////////////
    /**
     * Broadcasts the supplied to all the subscribed client socket connections.
     * 
     * @param operation the operation of the broadcast.
     * @param data the data to broadcast.
     * @param params the optional input/output parameters of the broadcast.
     */
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

    //////////////////////////////
    //////Attach
    //////////////////////////////
    /**
     * Attaches a receiver.
     * 
     * @param name the remote class name.
     * @param receiver the receiver to attach.
     */
    public attach(name: string, receiver: Receiver) {
        this.remoteClasses.push({ name, remoteFunctions: receiver.remoteFunctions });
        return this;
    }

    //////////////////////////////
    //////RemoteClass
    //////////////////////////////
    /**
     * Returns a `Receiver` to group remote functions that share related functionality.
     */
    public RemoteClass() {
        const receiver = { remoteFunctions: new Array<RemoteFunction>() } as Receiver;

        //Apply `Receiver` properties 👻.
        receiver.reply = (name: string, handler: IncomingHandler) => {
            receiver.remoteFunctions.push({ mode: 'REPLY', name, handler });
            return receiver;
        }
        return receiver;
    }
}

//////////////////////////////
//////Connection
//////////////////////////////
export interface ScpConnection extends Connection {
    /**
     * The unique identifier of the client socket connection.
     */
    identifier: string;
}

//////////////////////////////
//////Receiver
//////////////////////////////
/**
 * Interface for handling SCP I/O and registering remote functions.
 */
export interface Receiver {
    /**
     * The remote functions registered.
     */
    remoteFunctions: Array<RemoteFunction>;

    /**
     * Registers a remote function for handling REPLY I/O.
     * 
     * @param name the remote function name.
     * @param handler the incoming handler of the remote function.
     */
    reply: (name: string, handler: IncomingHandler) => this;
}

//////////////////////////////
//////Class/Function
//////////////////////////////
/**
 * Represents a group of remote functions that share related functionality.
 */
export interface RemoteClass {
    /**
     * The remote class name.
     */
    name: string;

    /**
     * The remote functions registered in the class.
     */
    remoteFunctions: Array<RemoteFunction>;
}

/**
 * Represents a remote function that handles I/O from clients.
 */
export interface RemoteFunction {
    /**
     * The remote function name.
     */
    name: string;

    /**
     * The mode of the remote function.
     */
    mode: Mode;

    /**
     * The incoming handler of the remote function.
     */
    handler: IncomingHandler;
}

/**
 * The SCP mode.
 */
export type Mode = 'REPLY' | 'ALL';

/**
 * The incoming handler.
 */
export type IncomingHandler = (incoming: Incoming, outgoing: Outgoing, proceed: ProceedFunction) => void;

/**
 * The proceed function.
 */
export type ProceedFunction = () => void;