//Import Libs.
import { once } from 'events';
import { finished } from 'stream';

//Import @iprotechs Libs.
import { Incoming, Outgoing, Server as ScpServer, Connection as ScpConnection, Broadcaster, ReplyHandler, BroadcastHandler, NextFunction } from '@iprotechs/scp';

//Import Local.
import Helper from './helper';

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
export default class Server extends ScpServer {
    /**
     * Creates an instance of SCP server.
     */
    constructor() {
        super();

        //Initialize Functions.
        this.reply('SCP.subscribe', this.subscribe());
    }

    //////////////////////////////
    //////Reply: Subscribe
    //////////////////////////////
    /**
     * Remote reply function that registers client subscriptions and allows them to receive broadcasts sent from the server.
     */
    private subscribe() {
        return async (incoming: Incoming, outgoing: Outgoing, next: NextFunction) => {
            //Read: Message(Subscribe) from incoming stream.
            try {
                for await (const chunk of incoming) { }
            } catch (error) {
                /* LIFE HAPPENS!!! */
            }

            //Set: Connection properties.
            (incoming.socket as Connection).identifier = incoming.getParam('CID');
            (incoming.socket as Connection).canBroadcast = true;

            //Write: Reply(Subscribe) to outgoing stream.
            finished(outgoing, (error) => { /* LIFE HAPPENS!!! */ });
            outgoing.end('');
        }
    }

    //////////////////////////////
    //////Broadcast
    //////////////////////////////
    /**
     * Broadcasts the supplied arguments to all the client socket connections.
     *
     * @param map the map of the broadcast.
     * @param payload the payload to broadcast.
     */
    public broadcast(map: string, ...payload: Array<any>) {
        return super.broadcast(map, payload);
    }
}

//////////////////////////////
//////Connection
//////////////////////////////
export class Connection extends ScpConnection {
    /**
     * The unique identifier of the client/connection.
     */
    public identifier: string;

    /**
     * Set to true to send broadcasts, false otherwise.
     */
    public canBroadcast: boolean;
}

//////////////////////////////
//////Reply
//////////////////////////////
/**
 * Returns a `ReplyHandler` that takes an asynchronous `replyFunction`.
 * This function converts input parameters to an `Incoming` message stream and output parameters to an `Outgoing` reply stream.
 * 
 * @param replyFunction The asynchronous function to handle the reply.
 * 
 * @example
 * ```
 * server.reply('User.create', remoteReply(async (user) => {
 *      return await UserDB.create(user);
 * }));
 * ```
 */
export function remoteReply<Reply>(replyFunction: ReplyFunction<Reply>): ReplyHandler {
    return async (incoming: Incoming, outgoing: Outgoing, next: NextFunction) => {
        //Looks like the message is not an object, Consumer needs to handle it!
        if (incoming.getParam('FORMAT') !== 'OBJECT') {
            next();
            return;
        }

        //Read: Message from incoming stream.
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

        //Write: Reply to outgoing stream.
        finished(outgoing, (error) => { /* LIFE HAPPENS!!! */ });
        if (!outgoing.write(reply)) {
            await once(outgoing, 'drain');
        }
        outgoing.end();
    }
}

export type ReplyFunction<Reply> = (...message: any) => Promise<Reply> | Reply;

//////////////////////////////
//////Broadcast
//////////////////////////////
/**
 * Returns a `BroadcastHandler` that broadcasts the payload passed from `server.broadcast()` into the `Outgoing` stream.
 * 
 * @example
 * ```
 * server.registerBroadcast('User.update', remoteBroadcast());
 * ```
 */
export function remoteBroadcast<Payload>(): BroadcastHandler<Payload> {
    return (payload: Payload, broadcaster: Broadcaster, next: NextFunction) => {
        const connections = broadcaster.connections.filter((connection: Connection) => connection.canBroadcast);

        //Write: Broadcast to outgoing stream.
        broadcaster.createOutgoing(connections, async (outgoing) => {
            outgoing.setParam('RFID', Helper.generateRFID());
            outgoing.setParam('FORMAT', 'OBJECT');

            finished(outgoing, (error) => { /* LIFE HAPPENS!!! */ });
            if (!outgoing.write(JSON.stringify(payload))) {
                await once(outgoing, 'drain');
            }
            outgoing.end();
        });
    }
}