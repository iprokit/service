//Import modules
import EventEmitter from 'events';

//Local Imports
import { Events, Defaults } from './microservice';
import { Topic, TopicExp, BroadcastTopicExp, Body, ErrorBody, IMessage, IReply, IBroadcast } from './comm';
import { MqttServer, Client, InPacket, OutPacket } from './comm.server';
import Utility from './utility';

//Route Types
export declare type Route = MessageReplyRoute | BroadcastRoute;

export declare type MessageReplyRoute = {
    topic: Topic;
    handler: MessageReplyHandler;
    name: string;
}

export declare type BroadcastRoute = {
    topic: Topic;
}

//Queue Types
export declare type Queue = MessageReplyQueue;
export declare type MessageReplyQueue = {
    message: Message;
    reply: Reply;
}

//Handlers
export declare type MessageReplyHandler = (message: Message, reply: Reply) => void;

export default class CommRouter extends EventEmitter{
    //MessageReply
    private readonly _messageReplyRoutes: Array<MessageReplyRoute>;
    private readonly _messageReplyRoutesHandler: EventEmitter;
    private readonly _messageReplySendingQueue: Array<MessageReplyQueue>;
    private readonly _messageReplySentQueue: Array<MessageReplyQueue>;

    //Broadcast
    private readonly _broadcastRoutes: Array<BroadcastRoute>;
    private readonly _broadcastHandler: EventEmitter;

    private _server: MqttServer;

    constructor(){
        //Call super for EventEmitter.
        super();

        //Init MessageReply.
        this._messageReplyRoutes = new Array();
        this._messageReplyRoutesHandler = new EventEmitter();
        this._messageReplySendingQueue = new Array();
        this._messageReplySentQueue = new Array();

        //Init Broadcast.
        this._broadcastRoutes = new Array();
        this._broadcastHandler = new EventEmitter();
    }

    /////////////////////////
    ///////Gets/Sets
    /////////////////////////
    public get routes(){
        return {messageReplys: this._messageReplyRoutes, broadcasts: this._broadcastRoutes};
    }

    public get queues(){
        return {messageReply: this.messageReplyQueue};
    }

    public get messageReplyQueue(){
        return {sending: this._messageReplySendingQueue, sent: this._messageReplySentQueue};
    }

    /////////////////////////
    ///////Init Functions
    /////////////////////////
    public reply(topic: Topic, handler: MessageReplyHandler){
        //Data-massage topic before handle.
        topic = topic.trim();

        //TODO: Allow only 2 topic levels.

        if(!this.getRoute(this._messageReplyRoutes, topic)){
            this._messageReplyRoutes.push({topic: topic, handler: handler, name: handler.name});
    
            //Add topic + handler to listener.
            this._messageReplyRoutesHandler.on(topic, handler);
        }
    }

    public defineBroadcast(topic: Topic){
        //Data-massage topic before handle.
        topic = topic.trim();

        //TODO: Allow only 1 topic level.

        if(!this.getRoute(this._broadcastRoutes, topic)){
            this._broadcastRoutes.push({topic: topic});
    
            //Add topic + broadcast handler to listener.
            this._broadcastHandler.on(topic, (broadcast: Broadcast) => this.sendPacket(broadcast.topic, broadcast.body));
        }
    }

    public broadcast(topic: Topic, body: Body){
        this.routeBroadcast(topic, body);
    }

    /////////////////////////
    ///////Connection Management
    /////////////////////////
    /**
     * Adds the routing listner.
     * 
     * @param server the object to listen and routes the packets.
     */
    public listen(server: MqttServer){
        //Pass server to local this server.
        this._server = server;

        this._server.on('published', (packet: InPacket, client: Client) => this.routePackets(packet, client));
    }

    /////////////////////////
    ///////Route
    /////////////////////////
    /**
     * Routes the incoming Packets.
     * 
     * @param packet the incoming packet from the server.
     * @param client the client oject from the server.
     */
    private routePackets(packet: InPacket, client: Client){
        //Listen to packets from client/node.
        if(client && client.id){
            //Convert Packet payload from Buffer to string.
            packet.payload = packet.payload.toString();

            //Router Emit.
            this.emit(Events.COMM_ROUTER_RECEIVED_PACKET, packet.topic, packet.payload);

            //Init variables.
            const topicExp = new TopicExp(packet.topic);
            const route = this.getRoute(this._messageReplyRoutes, topicExp.routingTopic);
            const body = this.toJSON(packet.payload);

            try{
                //Validate all conditions, on fail throws error.
                if(!route){
                    throw new TopicNotFound(packet.topic);
                }

                if(!topicExp.id){
                    throw new ActionNotPermitted(topicExp.topic);
                }

                if(this.isInQueue(topicExp, this._messageReplySendingQueue, this._messageReplySentQueue)){
                    throw new TopicUsed(topicExp.topic);
                }

                if(!body){
                    throw new InvalidJSON(packet.payload);
                }

                switch(topicExp.method){
                    case 'reply':
                        this.routeMessageReply(topicExp.topic, route, body);
                        break;
                    case 'transaction':
                        //TODO: Route Transaction
                        //Work from here.
                        break;
                    default :
                        throw new InvalidMethod(topicExp.method);
                }
            }catch(error){
                //Caught error sending packet back to the client/node.
                let errorBody: ErrorBody = { message: error.message, isError: true };
                this.sendPacket(packet.topic, errorBody);

                console.log('Caught error at broker: ', error.message);
                console.log('Will continue...');
            }
        }
    }

    /**
     * Routes the incoming packets as Message/Reply protocol.
     * 
     * @param topic to be routed.
     * @param route the routing object.
     * @param body the body to be routed.
     */
    private routeMessageReply<R extends Route, B extends Body>(topic: Topic, route: R, body: B){
        //Init Params.
        const message = new Message(topic, body);
        const reply = new Reply(topic);

        //Add Message/Reply to sending queue.
        this._messageReplySendingQueue.push({message: message, reply: reply});

        //Add listeners to reply object.
        reply.onReady((reply: Reply) => {
            //Sending packet back to the client/node.
            this.sendPacket(reply.topic, reply.body);

            //Sync Queue for sent and sending Array.
            this.syncQueue(reply, this._messageReplySendingQueue, this._messageReplySentQueue);
        });

        //Let the _messageReplyRoutesHandler know that the router is ready to receive its repsonse.
        this._messageReplyRoutesHandler.emit(route.topic, message, reply);
    }

    /**
     * Routes the outgoing packets as broadcast protocol.
     * 
     * @param topic to be routed.
     * @param body the body to be routed.
     */
    private routeBroadcast<B extends Body>(topic: Topic, body: B){
        //Data-massage topic before handle.
        topic = topic.trim();

        //Init variables.
        const topicExp = new BroadcastTopicExp(topic);
        const route = this.getRoute(this._broadcastRoutes, topicExp.routingTopic);

        //Validate all conditions, on fail throws error.
        if(!route){
            throw new TopicNotFound(topic);
        }

        if(Utility.isString(body)){
            throw new InvalidJSON(body);
        }

        //Init Params.
        const broadcast = new Broadcast(route.topic, body);

        //Let the _broadcastHandler know that the router is ready to receive its repsonse.
        this._broadcastHandler.emit(route.topic, broadcast);
    }

    /////////////////////////
    ///////Packet Handling 
    /////////////////////////
    /**
     * Publishes the packet on the server.
     * 
     * @param topic the topic to be sent on.
     * @param body the body to be sent.
     */
    private sendPacket<B extends Body>(topic: Topic, body: B){
        this._server.publish(this.toPacket(topic, body), (object, packet) => {
            //Router Emit.
            this.emit(Events.COMM_ROUTER_SENT_PACKET, topic, body);
        });
    }

    /////////////////////////
    ///////Helpers 
    /////////////////////////
    /**
     * Finds and returns the topic in the given routes array.
     * 
     * @param routes the array to search in.
     * @param topic the topic to find.
     * @returns the route found based on the given topic.
     */
    private getRoute<R extends Route>(routes: Array<R>, topic: Topic){
        return routes.find(route => route.topic === topic);
    }

    /**
     * Remove queue object from sending queue array and add it to sent queue array.
     *
     * @param reference of the queue object to be synced.
     * @param sendingQueue the sendingQueue array.
     * @param sentQueue the sentQueue array.
     */
    private syncQueue<R extends TopicExp, Q extends Queue>(reference: R, sendingQueue: Array<Q>, sentQueue: Array<Q>){
        const queue = sendingQueue.find(queue => queue.reply.topic === reference.topic);
        sendingQueue.splice(sendingQueue.indexOf(queue));
        sentQueue.push(queue);
    }

    /**
     * Validates if the given Topic Exp is in queue.
     * 
     * @param reference of the queue object to be searched with.
     * @param sendingQueue the sending queue array.
     * @param sentQueue the sent queue array.
     * @returns true if it exisists or false.
     */
    private isInQueue<R extends TopicExp, Q extends Queue>(reference: R, sendingQueue: Array<Q>, sentQueue: Array<Q>){
        let sending = sendingQueue.find(queue => queue && queue.message.topic === reference.topic && queue.reply.topic === reference.topic);
        let sent = sentQueue.find(queue => queue && queue.message.topic === reference.topic && queue.reply.topic === reference.topic);
        if(sending || sent){
            return true;
        }else{
            return false;
        }
    }

    /**
     * Converts the given body to JSON object and returns it.
     * 
     * @param body the object to convert to JSON.
     * @returns the converted json object.
     */
    private toJSON<B extends Body>(body: string): B{
        try{
            return JSON.parse(body);
        }catch(error){
            if(error instanceof SyntaxError){
                return;
            }
        }
    }

    /**
     * Converts the given topic and JSON object body to OutPacket and returns it.
     * 
     * @param topic required for packet creation.
     * @param body required for packet creation.
     * @returns the created OutPacket.
     */
    private toPacket<B extends Body>(topic: Topic, body: B): OutPacket{
        return {
            topic: topic,
            payload: JSON.stringify(body),
            qos: Defaults.COMM_PACKET_QOS,
            retain: Defaults.COMM_PACKET_RETAIN
        }
    }
}

/////////////////////////
///////Message/Reply
/////////////////////////
export class Message extends TopicExp implements IMessage {
    public readonly body: Body;

    constructor(topic: Topic, body: Body){
        //Call super for TopicExp.
        super(topic);

        //Init IMessage.
        this.body = body;
    }
}

export class Reply extends TopicExp implements IReply {
    public body: Body;
    public isError: boolean;
    private readonly _readyHandler: EventEmitter;

    constructor(topic: Topic, body?: Body){
        //Call super for TopicExp.
        super(topic);

        //Init IReply
        this.body = body;
        this.isError = false;
        this._readyHandler = new EventEmitter();
    }

    public error(error: boolean){
        this.isError = error;
        return this;
    }

    public send(body: Body){
        if(Utility.isString(body)){
            throw new InvalidJSON(body);
        }

        body.isError = this.isError;
        this.body = body;

        //Reply Emit.
        this._readyHandler.emit(Events.SEND_REPLY, this);
    }

    public onReady(fn: (reply: this) => void){
        this._readyHandler.once(Events.SEND_REPLY, fn);
    }
}

/////////////////////////
///////Broadcast
/////////////////////////
export class Broadcast extends BroadcastTopicExp implements IBroadcast {
    public readonly body: Body;

    constructor(topic: Topic, body: Body){
        //Call super for BroadcastTopicExp.
        super(topic);

        //Init IBroadcast
        this.body = body;
    }
}

/////////////////////////
///////Errors
/////////////////////////
export class TopicNotFound extends Error {
    constructor (topic: string) {
        //Call super for Error.
        super();
        
        //Init Error variables.
        this.name = this.constructor.name;
        this.message = 'Topic not found: ' + topic;
    
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
    }
}

export class TopicUsed extends Error {
    constructor (topic: string) {
        //Call super for Error.
        super();
        
        //Init Error variables.
        this.name = this.constructor.name;
        this.message = 'Topic already used: ' + topic;
    
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
    }
}

export class InvalidMethod extends Error {
    constructor (method: string) {
        //Call super for Error.
        super();
        
        //Init Error variables.
        this.name = this.constructor.name;
        this.message = 'Invalid Method: ' + method;
    
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ActionNotPermitted extends Error {
    constructor (topic: string) {
        //Call super for Error.
        super();
        
        //Init Error variables.
        this.name = this.constructor.name;
        this.message = 'Action not permitted on topic: ' + topic;
    
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
    }
}

export class InvalidJSON extends Error {
    constructor (json: any) {
        //Call super for Error.
        super();
        
        //Init Error variables.
        this.name = this.constructor.name;
        this.message = 'Invalid JSON object: ' + json;
    
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
    }
}