//Import modules
import EventEmitter from 'events';
import { Client } from 'mosca';

//Local Imports
import { Defaults, Events } from './microservice';
import { Topic, Message, Reply, Broadcast, ReplyTransaction, TopicHelper, MessageParms, ReplyBody, ReplyError } from './comm';

export declare type CommHandler = MessageReplyHandler | MessageReplyTransactionHandler;
export declare type MessageReplyHandler = (message: Message, reply: Reply) => void;
export declare type MessageReplyTransactionHandler = (message: Message, replyTransaction: ReplyTransaction) => void;

export declare type Method = 'reply' | 'transaction';
export declare type Route = {
    method: Method;
    topic: Topic;
    handler: CommHandler;
    name: string;
}

export type Packet = {
    topic: Topic;
    payload: Buffer;
    messageId: string;
    qos: number;
    retain: boolean;
}

export default class CommRouter extends EventEmitter{
    //Router Variables.
    public readonly name: string;

    //Broadcast Topic
    private readonly _broadcastTopic: Topic;

    //Routes
    private readonly _routes: Array<Route>;
    private readonly _routesHandler: EventEmitter;

    constructor(broadcastTopic?: Topic){
        //Call super for EventEmitter.
        super();

        //Init Router variables.
        this.name = global.service.name;

        //Init Broadcast Topic.
        this._broadcastTopic = broadcastTopic || Defaults.BROADCAST_TOPIC;

        //Init Routes.
        this._routes = new Array();
        this._routesHandler = new EventEmitter();
    }

    /////////////////////////
    ///////Routes
    /////////////////////////
    public reply(topic: Topic, handler: MessageReplyHandler){
        if(this.isUniqueTopic(topic)){
            this._routes.push({method: 'reply', topic: topic, handler: handler, name: handler.name});
    
            //Add topic + handler to listener.
            this._routesHandler.on(topic, handler);
        }
    }

    public transaction(topic: Topic, handler: MessageReplyTransactionHandler){
        if(this.isUniqueTopic(topic)){
            this._routes.push({method: 'transaction', topic: topic, handler: handler, name: handler.name});
    
            //Add topic + handler to listener.
            this._routesHandler.on(topic, handler);
        }
    }

    /////////////////////////
    ///////Listeners
    /////////////////////////
    public handleSubscribed(topic: string, client: Client){
        if(topic === this._broadcastTopic){
            this.sendBroadcast();
        }
    }

    public handlePublished(packet: Packet, client: Client){
        const topic = packet.topic;

        if (!topic.includes('$SYS/')) { //Ignoring all default $SYS/ topics.
            try{
                const route = this._routes.find(route => route.topic === topic);

                //Routing logic.
                if(route && route.method === 'reply'){
                    this.receiveMessage(packet);
                }else if((route && (route.method === 'transaction')) || new TopicHelper(topic).isTransactionTopic()){
                    this.receiveTransaction(packet);
                }
            }catch(error){
                if(error instanceof ReplySentWarning){
                    console.error(error);
                }
                //Do nothing.
            }
        }
    }

    /////////////////////////
    ///////Route
    /////////////////////////
    private sendBroadcast(){
        //Create Reply Object.
        const reply = this.createReply(this._broadcastTopic);

        //Define Broadcast
        const broadcast: Broadcast = {name: this.name, comms: this._routes};

        //Send Broadcast
        reply.send(broadcast);
    }

    /////////////////////////
    ///////Message/Reply
    /////////////////////////
    private receiveMessage(packet: Packet){
        //Convert string to Json.
        const payload = JSON.parse(packet.payload.toString());

        //Validate if the payload is from the broker or client.
        //If the below step is not done, it will run into a infinite loop.
        if(payload.message !== undefined && payload.reply === undefined){
            //creating new parms.
            const message = this.createMessage(packet.topic, payload.message.parms);
            const reply = this.createReply(packet.topic);

            //Passing parms to comm handler Emitter
            this._routesHandler.emit(packet.topic, message, reply);

            //Global Emit.
            //TODO:
            //this.emit(Events.COMM_SERVER_RECEIVED_MESSAGE, message);
        }
    }

    public sendReply(reply: BrokerReply){
        //Covert Json to string.
        const packet = {
            topic: reply.topic,
            payload: JSON.stringify({reply: {body: reply.body, error: reply.error}}),
            qos: 0,
            retain: false
        };

        this.emit(Events.COMM_ROUTER_SEND_PACKET, packet);
    }

    /////////////////////////
    ///////Transaction 
    /////////////////////////
    private receiveTransaction(packet: Packet){
        console.log('Broker', packet);

        //TODO: Work from here.
    }

    /////////////////////////
    ///////Helpers 
    /////////////////////////
    private isUniqueTopic(topic: Topic){
        return !this._routes.find(route => route.topic === topic);
    }

    public get routes(){
        return this._routes;
    }

    /////////////////////////
    ///////create Functions
    /////////////////////////
    /**
     * Creates a new Message object.
     * 
     * @param topic
     * @param parms 
     * @returns the new message object created.
     */
    private createMessage(topic: Topic, parms: MessageParms){
        const message = new BrokerMessage(topic, parms);
        return message;
    }

    /**
     * Creates a new Reply object.
     * @param topic 
     * @returns the new reply object created.
     */
    private createReply(topic: Topic){
        const reply = new BrokerReply(topic);

        //Attaching events to send reply back.
        reply._event.once(Events.REPLY_SEND, (reply) => this.sendReply(reply));
        reply._event.once(Events.REPLY_ERROR, (reply) => this.sendReply(reply));

        return reply;
    }
}

/////////////////////////
///////Message
/////////////////////////
export class BrokerMessage extends Message {
    constructor(topic: Topic, parms: MessageParms){
        super(topic, parms);
    }
}

/////////////////////////
///////Reply
/////////////////////////
export class BrokerReply extends Reply {
    private _sent: boolean;
    public readonly _event: EventEmitter;

    constructor(topic: Topic){
        super(topic);
        this._sent = false;
        this._event = new EventEmitter();
    }

    send(body: ReplyBody): void {
        //Ensure the reply is sent only once.
        if(!this._sent){
            this._sent = true;
            this._body = body;
            this._event.emit(Events.REPLY_SEND, this);
        }else{
            throw new ReplySentWarning();
        }
    }

    sendError(error: ReplyError): void {
        //Ensure the reply is sent only once.
        if(!this._sent){
            this._sent = true;
            this._error = error;
            this._event.emit(Events.REPLY_ERROR, this);
        }else{
            throw new ReplySentWarning();
        }
    }
}

/////////////////////////
///////Error Classes
/////////////////////////
export class ReplySentWarning extends Error {
    constructor () {
        super('Reply already sent.');
        
        // Saving class name in the property of our custom error as a shortcut.
        this.name = this.constructor.name;
    
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
      }
}