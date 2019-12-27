//Import modules
import EventEmitter from 'events';

//Local Imports
import { Events, Defaults } from './microservice';
import { Topic, TopicExp, IMessage, IReply, Broadcast } from './comm';
import { MqttServer, Client, InPacket, OutPacket } from './comm.server';

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

//Body Types
export declare type Body = {[key: string]: string};

//Queue Types
export declare type Queue = MessageReplyQueue;
export declare type MessageReplyQueue = {
    topic: string;
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
        //Data-massage topics before handle.
        topic = topic.trim();

        if(!this.getRoute(this._messageReplyRoutes, topic)){
            this._messageReplyRoutes.push({topic: topic, handler: handler, name: handler.name});
    
            //Add topic + handler to listener.
            this._messageReplyRoutesHandler.on(topic, handler);
        }
    }

    public defineBroadcast(topic: Topic){
        //Data-massage topics before handle.
        topic = topic.trim();

        if(!this.getRoute(this._broadcastRoutes, topic)){
            this._broadcastRoutes.push({topic: topic});
    
            //Add topic + broadcast handler to listener.
            this._broadcastHandler.on(topic, (topic: Topic, broadcast: Broadcast) => this.routeBroadcast(topic, broadcast));
        }
    }

    public broadcast(topic: Topic, broadcast: Broadcast){
        this._broadcastHandler.emit(topic, topic, broadcast);
    }

    /////////////////////////
    ///////Connection Management
    /////////////////////////
    public listen(server: MqttServer){
        //Pass server to local this server.
        this.server = server;

        this.server.on('published', (packet: InPacket, client: Client) => this.routeMessageReply(packet, client));
    }

    /////////////////////////
    ///////Route
    /////////////////////////
    public routeMessageReply(packet: InPacket, client: Client){
        //Listen to packets from client/node.
        if(client && client.id){
            //Convert Packet payload to string.
            packet.payload = packet.payload.toString();

            //Init variables.
            const topicExp = this.deriveTopicExp((this._messageReplyRoutes), packet.topic);
            const messageBody = this.toJSON(packet.payload);

            try{
                //Validate all conditions, on fail throws error.
                if(!topicExp){
                    throw new TopicNotFound(packet.topic);
                }

                if(!topicExp.id){
                    throw new ActionNotPermitted(packet.topic);
                }

                if(this.isInQueue(topicExp.topic, this._messageReplySendingQueue, this._messageReplySentQueue)){
                    throw new TopicUsed(topicExp.topic);
                }

                if(!messageBody){
                    throw new InvalidJSON(packet.payload);
                }

                //Init Params.
                const message = new Message(topicExp, messageBody);
                const reply = new Reply(topicExp);

                //Add Message/Reply to sending queue.
                this._messageReplySendingQueue.push({topic: topicExp.topic, message: message, reply: reply});

                //Router Emit.
                this.emit(Events.COMM_ROUTER_RECEIVED_MESSAGE, message);

                //Add listeners to reply object.
                reply.once(Events.SEND_REPLY, (reply: Reply) => {
                    //Sending packet back to the client/node.
                    this.server.publish(this.toPacket(topicExp.topic, reply.body), (object, packet) => {
                        //Sync Queue for sent and sending lists.
                        this.syncQueue(topicExp.topic, this._messageReplySendingQueue, this._messageReplySentQueue);

                        //Router Emit.
                        this.emit(Events.COMM_ROUTER_SENT_REPLY, reply);
                    });
                });

                //Let the _messageReplyRoutesHandler know that the router is ready to receive its repsonse.
                this._messageReplyRoutesHandler.emit(topicExp.routingTopic, message, reply);

            }catch(error){
                //Caught error sending packet back to the client/node.
                this.server.publish(this.toPacket(packet.topic, error.message), (object, packet) => {
                   console.log('Caught error at broker: ', error.message);
                   console.log('Will continue...');
                }); 
            }
        }
    }

    public routeBroadcast(topic: Topic, broadcast: Broadcast){
        const route = this.deriveTopicExp(this._broadcastRoutes, topic);
        console.log('routeBroadcast', broadcast);
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
     * @param routes the array to search in for base topic reference.
     * @param topic the topic to derive the params from.
     * @returns the topic params derived.
     */
    private deriveTopicExp<R extends Route>(routes: Array<R>, topic: Topic): TopicExp{
        //Data-massage topics before handle.
        topic = topic.trim();

        let route = routes.find(route => topic.startsWith(route.topic));
        if(route){
            //Derive topic params.
            let topicParams = topic.replace(route.topic, '').split('/').filter(Boolean);
            return {
                topic: topic,
                routingTopic: route.topic,
                id: topicParams[0],
                action: topicParams[1]
            }
        }
    }

    /**
     * 
     * Remove queue object from sending queue list and add it to sent queue list.
     *
     * @param topic of the queue object to be synced.
     * @param sendingQueue the sendingQueue list.
     * @param sentQueue the sentQueue list.
     */
    private syncQueue<Q extends Queue>(topic: Topic, sendingQueue: Array<Q>, sentQueue: Array<Q>){
        const queue = sendingQueue.find(queue => queue.topic === topic);
        sendingQueue.splice(sendingQueue.indexOf(queue));
        sentQueue.push(queue);
    }

    /**
     * Validates if the given topic is in queue.
     * 
     * @param topic the topic to be searched with.
     * @param sendingQueue the sending queue list.
     * @param sentQueue the sent queue list.
     * @returns true if it exisists or false.
     */
    private isInQueue<Q extends Queue>(topic: Topic, sendingQueue: Array<Q>, sentQueue: Array<Q>){
        let sending = sendingQueue.find(queue => queue.topic === topic);
        let sent = sentQueue.find(queue => queue.topic === topic);
        if(sending || sent){
            return true;
        }else{
            return false;
        }
    }

    /**
     * Converts the given packet to JSON object and returns it.
     * 
     * @param packet the packet to convert.
     * @returns the converted json object.
     */
    private toJSON(body: string): Body{
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
    private toPacket(topic: Topic, body: Body): OutPacket{
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
    public readonly id: string;
    public readonly action: string;

    //IMessage
    public readonly body: Body;

    constructor(topicExp: TopicExp, body: Body){
        //Init Topic Exp.
        this.topic = topicExp.topic;
        this.routingTopic = topicExp.routingTopic;
        this.id = topicExp.id;
        this.action = topicExp.action;

        //Init IMessage.
        this.body = body;
    }
}

export class Reply extends EventEmitter implements TopicExp, IReply {
    //Topic Exp
    public readonly topic: string;
    public readonly routingTopic: string;
    public readonly id: string;
    public readonly action: string;

    //IReply
    public body: Body;
    public isError: boolean;

    constructor(topicExp: TopicExp){
        //Call super for EventEmitter.
        super();

        //Init Topic Exp.
        this.topic = topicExp.topic;
        this.routingTopic = topicExp.routingTopic;
        this.id = topicExp.id;
        this.action = topicExp.action;

        //Init IReply.
        this.isError = false;
    }

    public send(body: Body){
        this.body = body;

        //Reply Emit.
        this.emit(Events.SEND_REPLY, this);
    }

    public error(error: boolean){
        this.isError = error;
        return this;
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
    constructor (json: string) {
        //Call super for Error.
        super();
        
        //Init Error variables.
        this.name = this.constructor.name;
        this.message = 'Invalid JSON object: ' + json;
    
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