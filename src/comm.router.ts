//Import modules
import EventEmitter from 'events';

//Local Imports
import { Events } from './microservice';
import { Topic, Message, Reply } from './comm';
import { MqttServer, Client, Packet } from './comm.server';

//Route Types
export declare type Route = MessageReplyRoute | ActionRoute;

export declare type MessageReplyRoute = {
    topic: Topic;
    handler: MessageReplyHandler;
    name: string;
}

export declare type ActionRoute = {
    topic: Topic;
    name: string;
}

//Handlers
export declare type MessageReplyHandler = (message: Message, reply: Reply) => void;

export default class CommRouter {
    //MessageReply
    private readonly _messageReplyRoutes: Array<MessageReplyRoute>;
    private readonly _messageReplyRoutesHandler: EventEmitter;

    //Action
    private readonly _actionRoutes: Array<ActionRoute>;
    private readonly _serviceActionHandler: EventEmitter;

    constructor(){
        //Init MessageReply.
        this._messageReplyRoutes = new Array();
        this._messageReplyRoutesHandler = new EventEmitter();

        //Init MessageReply.
        this._actionRoutes = new Array();
        this._serviceActionHandler = new EventEmitter();
    }

    /////////////////////////
    ///////Gets/Sets
    /////////////////////////
    public get routes(){
        return {messageReplys: this._messageReplyRoutes, actions: this._actionRoutes};
    }

    public get serviceAction(){
        return this._serviceActionHandler;
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

    public defineAction(topic: Topic){
        if(this.isUniqueTopic(this._actionRoutes, topic)){
            this._actionRoutes.push({topic: topic, name: topic});
    
            //Add topic + handler to listener.
            this._serviceActionHandler.on(topic, (body) => {
                //Send Reply
            });
        }
    }

    /////////////////////////
    ///////Connection Management
    /////////////////////////
    public listen(server: MqttServer){
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
    }

    /////////////////////////
    ///////Helpers 
    /////////////////////////
    private isUniqueTopic(routes: Array<Route>, topic: Topic){
        return !routes.find(route => route.topic === topic);
    }
}