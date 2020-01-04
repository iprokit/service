//Import modules
import EventEmitter from 'events';

import { Events } from "../store/events";
import { Defaults } from "../store/defaults";
import { Topic, Body, ErrorBody, IMessage, IReply, IBroadcast } from '../store/comm';
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

//Handlers
export declare type MessageReplyHandler = (message: Message, reply: Reply) => void;

export default class CommRouter extends EventEmitter{
    //MessageReply
    private readonly _messageReplyRoutes: Array<MessageReplyRoute>;
    private readonly _messageReplyRoutesHandler: EventEmitter;

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

    /////////////////////////
    ///////Handler Functions
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

    /////////////////////////
    ///////Broadcast Function
    public broadcast(topic: Topic, body: Body){
        this.routeBroadcast(topic, body);
    }

    /////////////////////////
    ///////Define Functions
    /////////////////////////
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
    ///////Routes Managment
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
            const route = this.getRoute(this._messageReplyRoutes, packet.topic);
            const body = this.toJSON(packet.payload);

            try{
                //Validate all conditions, on fail throws error.
                if(!route){
                    throw new TopicNotFound(packet.topic);
                }

                this.routeMessageReply(packet.topic, route, body);
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
     * @param topicExp to be routed.
     * @param route the routing object.
     * @param body the body to be routed.
     */
    private routeMessageReply<R extends Route, B extends Body>(topic: Topic, route: R, body: B){
        //Init Params.
        const message = new Message(topic, body);
        const reply = new Reply(topic);

        //Add listeners to reply object.
        reply.onReady((reply: Reply) => {
            //Sending packet back to the client/node.
            this.sendPacket(reply.topic, reply.body);
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
        const route = this.getRoute(this._broadcastRoutes, topic);

        //Validate all conditions, on fail throws error.
        if(!route){
            throw new TopicNotFound(topic);
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
export class Message implements IMessage {
    public readonly topic: Topic;
    public readonly body: Body;

    constructor(topic: Topic, body: Body){
        //Init IMessage.
        this.topic = topic;
        this.body = body;
    }
}

export class Reply implements IReply {
    public readonly topic: Topic;
    public body: Body;
    public isError: boolean;
    private readonly _readyHandler: EventEmitter;

    constructor(topic: Topic){
        //Init IReply
        this.topic = topic;
        this.isError = false;
        this._readyHandler = new EventEmitter();
    }

    public error(error: boolean){
        this.isError = error;
        return this;
    }

    public send(body: Body){
        body.isError = this.isError;
        this.body = body;

        //Reply Emit.
        this._readyHandler.emit(Events.COMM_ROUTER_SEND_REPLY, this);
    }

    public onReady(fn: (reply: this) => void){
        this._readyHandler.once(Events.COMM_ROUTER_SEND_REPLY, fn);
    }
}

/////////////////////////
///////Broadcast
/////////////////////////
export class Broadcast implements IBroadcast {
    public readonly topic: Topic;
    public readonly body: Body;

    constructor(topic: Topic, body: Body){
        //Init IBroadcast
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