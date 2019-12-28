//Import modules
import EventEmitter from 'events';

//Local Imports
import { Events, Defaults } from './microservice';
import { Topic, TopicExp, Body, IMessage, IReply, IBroadcast } from './comm';
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

    private server: MqttServer;

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

        if(!this.getRoute(this._messageReplyRoutes, topic)){
            this._messageReplyRoutes.push({topic: topic, handler: handler, name: handler.name});
    
            //Add topic + handler to listener.
            this._messageReplyRoutesHandler.on(topic, handler);
        }
    }

    public defineBroadcast(topic: Topic){
        //Data-massage topic before handle.
        topic = topic.trim();

        if(!this.getRoute(this._broadcastRoutes, topic)){
            this._broadcastRoutes.push({topic: topic});
    
            //Add topic + broadcast handler to listener.
            this._broadcastHandler.on(topic, (broadcast: Broadcast) => this.routeBroadcast(broadcast));
        }
    }

    public broadcast(topic: Topic, body: Body){
        //Data-massage topic before handle.
        topic = topic.trim();

        //Validate all conditions, on fail throws error.
        if(!this.getRoute(this._broadcastRoutes, topic)){
            throw new TopicNotFound(topic);
        }

        if(Utility.isString(body)){
            throw new InvalidJSON(body);
        }

        //Init Params.
        const broadcast = new Broadcast(topic, body);

        //Let the _broadcastHandler know that the router is ready to receive its repsonse.
        this._broadcastHandler.emit(topic, broadcast);
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
        this.server = server;

        this.server.on('published', (packet: InPacket, client: Client) => this.routeMessageReply(packet, client));
    }

    /////////////////////////
    ///////Route
    /////////////////////////
    /**
     * Routes the incoming Message's and sends reply's.
     * 
     * @param packet the incoming packet from the server.
     * @param client the client boject from the server.
     */
    public routeMessageReply(packet: InPacket, client: Client){
        //Listen to packets from client/node.
        if(client && client.id){
            //Convert Packet payload from Buffer to string.
            packet.payload = packet.payload.toString();

            //Init variables.
            const topicExp = this.deriveTopicExp(packet.topic);
            const route = this.getRoute(this._messageReplyRoutes, topicExp.routingTopic);
            const messageBody = this.toJSON(packet.payload);

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

                if(!messageBody){
                    throw new InvalidJSON(packet.payload);
                }

                //Init Params.
                const message = new Message(topicExp, messageBody);
                const reply = new Reply(topicExp);

                //Add Message/Reply to sending queue.
                this._messageReplySendingQueue.push({message: message, reply: reply});

                //Router Emit.
                this.emit(Events.COMM_ROUTER_RECEIVED_PACKET, message);

                //Add listeners to reply object.
                reply.once(Events.SEND_REPLY, (reply: Reply) => {
                    //Sending packet back to the client/node.
                    this.sendPacket(reply.topic, reply.body);

                    //Sync Queue for sent and sending Array.
                    this.syncQueue(reply, this._messageReplySendingQueue, this._messageReplySentQueue);

                    //Router Emit.
                    this.emit(Events.COMM_ROUTER_SENT_PACKET, reply);
                });

                //Let the _messageReplyRoutesHandler know that the router is ready to receive its repsonse.
                this._messageReplyRoutesHandler.emit(route.topic, message, reply);
            }catch(error){
                //Caught error sending packet back to the client/node.
                this.sendPacket(packet.topic, error.message);

                console.log('Caught error at broker: ', error.message);
                console.log('Will continue...');
            }
        }
    }

    /**
     * Routes the outgoing broadcasts.
     * 
     * @param broadcast the object to be broadcasted.
     */
    public routeBroadcast(broadcast: Broadcast){
        this.sendPacket(broadcast.topic, broadcast.body);
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
        this.server.publish(this.toPacket(topic, body), (object, packet) => {
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
     * Derives the topic params from the given topic.
     * 
     * @param topic the topic to derive the params from.
     * @returns the topic params derived.
     */
    private deriveTopicExp(topic: Topic): TopicExp{
        //Data-massage topics before handle.
        topic = topic.trim();

        const stack = topic.split('/');
        return {
            topic: topic,
            routingTopic: stack[0] + '/' + stack[1],
            class: stack[0],
            function: stack[1],
            id: stack[2],
            action: stack[3],
            stack: stack
        }
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
export class Message implements TopicExp, IMessage {
    //Topic Exp
    public readonly topic: string;
    public readonly routingTopic: string;
    public readonly class: string;
    public readonly function: string;
    public readonly id: string;
    public readonly action: string;
    public readonly stack: Array<string>;

    //IMessage
    public readonly body: Body;

    constructor(topicExp: TopicExp, body: Body){
        //Init Topic Exp.
        this.topic = topicExp.topic;
        this.routingTopic = topicExp.routingTopic;
        this.class = topicExp.class;
        this.function = topicExp.function;
        this.id = topicExp.id;
        this.action = topicExp.action;
        this.stack = topicExp.stack;

        //Init IMessage.
        this.body = body;
    }
}

export class Reply extends EventEmitter implements TopicExp, IReply {
    //Topic Exp
    public readonly topic: string;
    public readonly routingTopic: string;
    public readonly class: string;
    public readonly function: string;
    public readonly id: string;
    public readonly action: string;
    public readonly stack: Array<string>;

    //IReply
    public body: Body;
    public isError: boolean;

    constructor(topicExp: TopicExp){
        //Call super for EventEmitter.
        super();

        //Init Topic Exp.
        this.topic = topicExp.topic;
        this.routingTopic = topicExp.routingTopic;
        this.class = topicExp.class;
        this.function = topicExp.function;
        this.id = topicExp.id;
        this.action = topicExp.action;
        this.stack = topicExp.stack;

        //Init IReply
        this.isError = false;
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
        this.emit(Events.SEND_REPLY, this);
    }
}

/////////////////////////
///////Broadcast
/////////////////////////
export class Broadcast implements IBroadcast {
    public readonly topic: string;
    public readonly body: Body;

    constructor(topic: string, body: Body){
        this.topic = topic;
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