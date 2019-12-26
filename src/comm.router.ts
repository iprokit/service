//Import modules
import EventEmitter from 'events';

//Local Imports
import { Topic, Message, Reply, Broadcast } from './comm';
import { MqttServer, Client, Packet } from './comm.server';

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

//Local Comm Interfaces
export interface MessageStack {
    topic: Topic;
    message: Message;
}

export interface ReplyStack {
    topic: Topic;
    reply: Reply;
}

export interface BroadcastStack {
    topic: Topic;
    broadcast: Broadcast;
}

//Handlers
export declare type MessageReplyHandler = (message: MessageStack, reply: ReplyStack) => void;

export default class CommRouter {
    //MessageReply
    private readonly _messageReplyRoutes: Array<MessageReplyRoute>;
    private readonly _messageReplyRoutesHandler: EventEmitter;

    //Broadcast
    private readonly _broadcastRoutes: Array<BroadcastRoute>;
    private readonly _broadcastHandler: EventEmitter;

    constructor(){
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
    ///////Init Functions
    /////////////////////////
    public reply(topic: Topic, handler: MessageReplyHandler){
        if(this.isUniqueTopic(this._messageReplyRoutes, topic)){
            this._messageReplyRoutes.push({topic: topic, handler: handler, name: handler.name});
    
            //Add topic + handler to listener.
            this._messageReplyRoutesHandler.on(topic, handler);
        }
    }

    public defineBroadcast(topic: Topic){
        if(this.isUniqueTopic(this._broadcastRoutes, topic)){
            this._broadcastRoutes.push({topic: topic});
    
            //Add topic + broadcast handler to listener.
            this._broadcastHandler.on(topic, this.routeBroadcast);
        }
    }

    public broadcast(topic: Topic, broadcast: Broadcast){
        const broadcastStack: BroadcastStack = {topic: topic, broadcast: broadcast};

        this._broadcastHandler.emit(topic, broadcastStack);
    }

    /////////////////////////
    ///////Connection Management
    /////////////////////////
    public listen(server: MqttServer){
        //Listen to packets coming from clients/nodes.
        server.on('published', (packet: Packet, client: Client) => this.routeMessageReply(packet, client));
    }

    /////////////////////////
    ///////Route
    /////////////////////////
    public routeMessageReply(packet: Packet, client: Client){
        if(client && client.id){
            const routingTopic = packet.topic;
            console.log('routeMessageReply', routingTopic);
        }
    }

    public routeBroadcast(broadcast: BroadcastStack){
        console.log('routeBroadcast', broadcast);
    }

    /////////////////////////
    ///////Helpers 
    /////////////////////////
    private isUniqueTopic(routes: Array<Route>, topic: Topic){
        return !routes.find(route => route.topic === topic);
    }
}