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
     * The remote functions on the server.
     */
    public readonly remoteFunctions: Array<RemoteFunction>;

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
        this.remoteFunctions = new Array();

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
        this.transport(0, incoming, outgoing);
    }

    //////////////////////////////
    //////Transport
    //////////////////////////////
    /**
     * Recursively loop through the remote functions to find and execute its handler.
     * 
     * @param index the iteration of the loop.
     * @param incoming the incoming stream.
     * @param outgoing the outgoing stream.
     */
    private transport(index: number, incoming: Incoming, outgoing: Outgoing) {
        const remoteFunction = this.remoteFunctions[index++];

        //Need I say more.
        if (!remoteFunction) return;

        //Shits about to go down! 😎
        const mode = (remoteFunction.mode === incoming.mode || remoteFunction.mode === '*') ? true : false;
        const className = (remoteFunction.className === incoming.rfi.className || remoteFunction.className === '*') ? true : false;
        const functionName = (remoteFunction.functionName === incoming.rfi.functionName || remoteFunction.functionName === '*') ? true : false;

        if (mode && className && functionName) {
            //Remote function found, lets execute the handler.
            const proceed: ProceedFunction = () => this.transport(index, incoming, outgoing);
            remoteFunction.handler(incoming, outgoing, proceed);
        } else {
            //Remote function not found, lets keep going though the loop.
            this.transport(index, incoming, outgoing);
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
    //////Reply
    //////////////////////////////
    /**
     * Registers a remote function for handling REPLY.
     * 
     * @param operation the operation of the remote function.
     * @param handler the handler of the remote function.
     */
    public reply(operation: string, handler: RemoteFunctionHandler) {
        this.remoteFunctions.push(new RemoteFunction('REPLY', operation, handler));
        return this;
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
//////Remote Function
//////////////////////////////
/**
 * `RemoteFunction` represents a function that can be executed by a client.
 */
export class RemoteFunction extends RFI {
    /**
     * The handler of remote function.
     */
    public readonly handler: RemoteFunctionHandler;

    /**
     * Creates an instances of `RemoteFunction`.
     * 
     * @param mode the mode of remote function.
     * @param operation the operation of remote function.
     * @param handler the handler of remote function.
     */
    constructor(mode: Mode, operation: string, handler: RemoteFunctionHandler) {
        super(mode, operation);

        //Initialize Options.
        this.handler = handler;
    }
}

/**
 * The remote function mode.
 */
export type Mode = 'REPLY';

/**
 * The remote function handler.
 */
export type RemoteFunctionHandler = (incoming: Incoming, outgoing: Outgoing, proceed: ProceedFunction) => void;

/**
 * The proceed function.
 */
export type ProceedFunction = () => void;