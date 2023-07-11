//Import Libs.
import { finished } from 'stream';

//Import @iprotechs Libs.
import { RFI, Incoming, Outgoing, Server, Connection } from '@iprotechs/scp';

//Import Local.
import { generateRFID, NextFunction } from './common';

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
        outgoing.setParam('RFID', incoming.getParam('RFID'));
        outgoing.setParam('SID', this.identifier);

        //Handle Subscribe.
        if (incoming.mode === 'SUBSCRIBE' && incoming.map === 'SCP.subscribe') {
            this.subscribe(incoming, outgoing);
            return;
        }

        //Below line will blow your mind! 🤯
        this.transport(0, incoming, outgoing);
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
        finished(incoming, (error) => { /* LIFE HAPPENS!!! */ });
        incoming.resume();

        //Set: Connection properties.
        (incoming.socket as ScpConnection).identifier = incoming.getParam('CID');
        (incoming.socket as ScpConnection).canBroadcast = true;

        //Write: Outgoing stream.
        finished(outgoing, (error) => { /* LIFE HAPPENS!!! */ });
        outgoing.end('');
    }

    //////////////////////////////
    //////Reply
    //////////////////////////////
    /**
     * Creates an `Incoming` stream to receive a message and `Outgoing` stream to send a reply.
     * 
     * @param map the map of the remote reply function.
     * @param handler the handler of the remote reply function.
     */
    public createReply(map: string, handler: RemoteFunctionHandler) {
        this.remoteFunctions.push(new RemoteFunction('REPLY', map, handler));
        return this;
    }

    /**
     * Receives a message and returns a promise that resolves a reply.
     * 
     * @param map the map of the remote reply function.
     * @param replyFunction the remote reply function.
     */
    public reply<Reply>(map: string, replyFunction: ReplyFunction<Reply>) {
        this.createReply(map, async (incoming: Incoming, outgoing: Outgoing, next: NextFunction) => {
            //Looks like the message is not an object, Consumer needs to handle it!
            if (incoming.getParam('FORMAT') !== 'OBJECT') {
                next();
                return;
            }

            //Read: Incoming stream.
            let chunks = '';
            try {
                for await (const chunk of incoming) {
                    chunks += chunk;
                }
            } catch (error) {
                /* LIFE HAPPENS!!! */
            }

            //Execute: Reply function.
            let reply = '';
            try {
                let returned = await replyFunction(...JSON.parse(chunks));
                reply = (returned !== undefined || null) ? JSON.stringify(returned) : JSON.stringify({});
                outgoing.setParam('STATUS', 'OK');
            } catch (error) {
                delete error.stack; /* Delete stack from error because we dont need it. */
                reply = JSON.stringify(error, Object.getOwnPropertyNames(error));
                outgoing.setParam('STATUS', 'ERROR');
            }

            //Write: Outgoing stream.
            finished(outgoing, (error) => { /* LIFE HAPPENS!!! */ });
            outgoing.setParam('FORMAT', 'OBJECT');
            outgoing.end(reply);
        });
        return this;
    }

    //////////////////////////////
    //////Broadcast
    //////////////////////////////
    /**
     * Broadcasts the supplied to all the subscribed client socket connections.
     * 
     * @param map the map of the broadcast.
     * @param payload the payload to broadcast.
     */
    public broadcast(map: string, ...payload: Array<any>) {
        for (const connection of this.connections) {
            if (!connection.canBroadcast) continue;

            connection.createOutgoing((outgoing: Outgoing) => {
                outgoing.setRFI(new RFI('BROADCAST', map));
                outgoing.setParam('RFID', generateRFID());
                outgoing.setParam('SID', this.identifier);
                outgoing.setParam('FORMAT', 'OBJECT');
                outgoing.end(JSON.stringify(payload));
            });
        }
        return this;
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
            const next: NextFunction = () => this.transport(index, incoming, outgoing);
            remoteFunction.handler(incoming, outgoing, next);
        } else {
            //Remote function not found, lets keep going though the loop.
            this.transport(index, incoming, outgoing);
        }
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

    /**
     * Set to true to send broadcasts, false otherwise.
     */
    canBroadcast: boolean;
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
     * @param map the map of remote function.
     * @param handler the handler of remote function.
     */
    constructor(mode: Mode, map: string, handler: RemoteFunctionHandler) {
        super(mode, map);

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
export type RemoteFunctionHandler = (incoming: Incoming, outgoing: Outgoing, next: NextFunction) => void;

//////////////////////////////
//////Reply Function
//////////////////////////////
/**
 * The reply function.
 */
export type ReplyFunction<Reply> = (...message: any) => Promise<Reply> | Reply;