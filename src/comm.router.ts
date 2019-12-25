//Import modules
import EventEmitter from 'events';

//Local Imports
import { Events } from './microservice';
import { Topic, Method, Message, Reply, TransactionMessage, TransactionReply } from './comm';
import { MqttServer, Client, Packet } from './comm.server';
import { TopicHelper } from './comm2';

export declare type CommHandler = MessageReplyHandler | MessageReplyTransactionHandler;
export declare type MessageReplyHandler = (message: RouterMessage, reply: RouterReply) => void;
export declare type MessageReplyTransactionHandler = (message: RouterTransactionMessage, reply: RouterTransactionReply) => void;

export declare interface Route {
    method: Method;
    topic: Topic;
    handler: CommHandler;
    name: string;
}

export interface ICommRouter {
    send(reply: Reply): void;
}

export default class CommRouter implements ICommRouter {
    //Routes
    private readonly _routes: Array<Route>;
    private readonly _routesHandler: EventEmitter;
    private readonly _packetHandler: EventEmitter;

    //TODO: Need to implement this.
    private readonly _sentQueue: any;
    private readonly _sendingQueue: any;

    constructor(){
        //Init Routes.
        this._routes = new Array();
        this._routesHandler = new EventEmitter();
        this._packetHandler = new EventEmitter();
    }

    /////////////////////////
    ///////Routes
    /////////////////////////
    public reply(topic: Topic, handler: MessageReplyHandler){
        //TODO: Check if topic is valid by calling regular expression.
        if(this.isUniqueTopic(topic)){
            this._routes.push({method: 'reply', topic: topic, handler: handler, name: handler.name});
    
            //Add topic + handler to listener.
            this._routesHandler.on((topic as string), handler);
        }
    }

    public transaction(topic: Topic, handler: MessageReplyTransactionHandler){
        //TODO: Check if topic is valid by calling regular expression.
        if(this.isUniqueTopic(topic)){
            this._routes.push({method: 'transaction', topic: topic, handler: handler, name: handler.name});
    
            //Add topic + handler to listener.
            this._routesHandler.on((topic as string), handler);
        }
    }

    /////////////////////////
    ///////Connection Management
    /////////////////////////
    public listen(server: MqttServer){
        //Send packets to clients/nodes.
        this._packetHandler.on(Events.COMM_ROUTER_SEND_PACKET, (packet) => {
            server.publish(packet, () => {});
        });

        //Listen to packets coming from clients/nodes.
        server.on('published', (packet: Packet, client: Client) => {
            this.route(packet, client);
        });
    }

    /////////////////////////
    ///////Route
    /////////////////////////
    public route(packet: Packet, client: Client){
        const topic = packet.topic;

        if (!topic.includes('$SYS/')) { //Ignoring all default $SYS/ topics.
            try{
                const route = this._routes.find(route => route.topic === topic);

                const id = client && client.id;
                console.log(id, packet);

                //Routing logic.
                if (route && route.method === 'reply'){
                    this.receiveMessage(packet);
                }else if((route && (route.method === 'transaction')) || new TopicHelper(topic).isTransactionTopic()){
                    // this.receiveTransaction(packet);
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
    ///////Message/Reply
    /////////////////////////
    private receiveMessage(packet: Packet){
        //Convert string to Json.
        const payload = JSON.parse(packet.payload.toString());

        //Validate if the payload is from the Server or client.
        //If the below step is not done, it will run into a infinite loop.
        if(payload.message !== undefined && payload.reply === undefined){
            //creating new parms.
            const message = new RouterMessage(packet.topic, payload.message.parms);
            const reply = new RouterReply(packet.topic);

            //Attaching events to send reply back.
            reply._event.once(Events.REPLY_SEND, (reply) => this.send(reply));

            //Passing parms to comm handler Emitter
            this._routesHandler.emit(packet.topic, message, reply);
        }
    }

    public send(reply: RouterReply){
        //Covert Json to string.
        const packet = {
            topic: reply.id, //Change this to topic.
            payload: JSON.stringify({reply: {body: reply.body, error: reply.error}}),
            qos: 2,
            retain: false
        };

        this._packetHandler.emit(Events.COMM_ROUTER_SEND_PACKET, packet);
    }

    /////////////////////////
    ///////Helpers 
    /////////////////////////
    private isUniqueTopic(topic: Topic){
        return !this._routes.find(route => route.topic === topic);
    }

    public get stack(){
        return this._routes;
    }
}

/////////////////////////
///////Message/Reply
/////////////////////////
export class RouterMessage extends Message {
    constructor(id: string, parms: any){
        super(id, parms);
    }
}

export class RouterReply extends Reply implements ICommRouter {
    private _sent: boolean;
    public readonly _event: EventEmitter;

    constructor(id: string){
        super(id);
        this._sent = false;
        this._event = new EventEmitter();
    }

    public send(body: any) {
        //Ensure the reply is sent only once.
        if(!this._sent){
            this._sent = true;
            this.body = body;
            this._event.emit(Events.REPLY_SEND, this);
        }else{
            throw new ReplySentWarning();
        }
    }
}

/////////////////////////
///////Transaction
/////////////////////////
export class RouterTransactionMessage extends TransactionMessage {
    commit: boolean;
    rollback: boolean;

    constructor(id: string, parms: any){
        super(id, parms);
    }
}

export class RouterTransactionReply extends TransactionReply {
    committed: boolean;
    rolledback: boolean;

    constructor(id: string, body: any, error?: boolean){
        super(id, body, error);
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