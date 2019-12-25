//Import modules
import EventEmitter from 'events';

//Local Imports
import { Events } from './microservice';
import { Topic, Message, Reply, Comm } from './comm';
import { MqttServer, Client, Packet } from './comm.server';
import { TopicHelper } from './comm2';

export declare type MessageReplyHandler = (message: RouterMessage, reply: RouterReply) => void;

export declare interface Route {
    topic: Topic;
    handler: MessageReplyHandler;
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
        if(this.isUniqueTopic(topic)){
            this._routes.push({topic: topic, handler: handler, name: handler.name});
    
            //Add topic + handler to listener.
            this._routesHandler.on(topic, handler);
        }
    }

    public registerAction(name: string, action: any){

    }

    public emitAction(name: string, action: any){
        //TODO: Implement this.
    }

    /////////////////////////
    ///////Connection Management
    /////////////////////////
    public listen(server: MqttServer){
        //Send packets to clients/nodes.
        this._packetHandler.on(Events.COMM_ROUTER_SEND_PACKET, (packet) => {
            server.publish(packet, () => {});
        });

        server.on('subscribe', (topic: any, client: Client) => {
            console.log(topic, client.id);
        });

        //Listen to packets coming from clients/nodes.
        server.on('published', (packet: Packet, client: Client) => {

            //Validate if client id exists. Then pass control to route.
            if(client && client.id){
                this.route(packet, client);
            }
        });
    }

    /////////////////////////
    ///////Route
    /////////////////////////
    public route(packet: Packet, client: Client){
        const routingTopic = packet.topic;

        console.log(routingTopic);

        //Step 1: Based on topic find route.
        //Step 2: Generate new UUID.
        //Step 3: Generate comm Object.
        //Step 4: Push comm Object to _sendingQueue.
        //Step 5: Pass control to specific route.

        //Control is back.
        //Step 1: Remove comm Object from _sendingQueue.
        //Step 2: Add comm Object to _sentQueue.
        //Step 3: Respond back to the client.

        // let commId = 'uuid';
        // const comm: Comm<RouterMessage, RouterReply> = {
        //     clientId: client.id,
        //     commId: commId,
        //     method: 'reply',
        //     topic: packet.topic,
        //     message: new RouterMessage(commId),
        //     reply: new RouterReply(commId)
        // };


        // const topic = packet.topic;
        // const route = this._routes.find(route => route.topic === topic);

        // //Routing logic.
        // if (route && route.method === 'reply'){
        //     this.receiveMessage(packet);
        // }else if((route && (route.method === 'transaction')) || new TopicHelper(topic).isTransactionTopic()){
        //     // this.receiveTransaction(packet);
        // }
    }

    /////////////////////////
    ///////Message/Reply
    /////////////////////////
    private receiveMessage(packet: Packet){
        //Convert string to Json.
        const payload = JSON.parse(packet.payload.toString());

        //creating new parms.
        const message = new RouterMessage(packet.topic, payload.message.parms);
        const reply = new RouterReply(packet.topic);

        //Attaching events to send reply back.
        reply.once(Events.REPLY_SEND, (reply) => this.send(reply));

        //Passing parms to comm handler Emitter
        this._routesHandler.emit(packet.topic, message, reply);
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

    public get routes(){
        return this._routes;
    }
}

/////////////////////////
///////Message/Reply
/////////////////////////
export class RouterMessage implements Message {
    id: string;
    parms: any;

    constructor(id: string, parms: string){
        this.id = id;
        this.parms = parms;
    }
}

export class RouterReply extends EventEmitter implements Reply, ICommRouter {
    id: string;
    body: any;
    error: boolean;

    constructor(id: string){
        //Call super for EventEmitter.
        super();

        this.id = id;
        this.error = false;
    }

    public send(body: any) {
        this.body = body;
        this.emit(Events.REPLY_SEND, this);
    }

    public isError(error: boolean){
        this.error = error;
        return this;
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