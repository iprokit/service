//Import modules
import EventEmitter from 'events';
import { Server as MqttServer, Client, Packet as InPacket, Message as OutPacket} from 'mosca';

//Export libs.
export { MqttServer, Client, InPacket, OutPacket };

import { Events } from "../store/events";
import { Defaults } from "../store/defaults";
import { IServer, ConnectionState } from "../store/component";
import { Topic, Body, Handshake } from '../store/comm';
import { Publisher } from "../generics/publisher";
import CommRouter, { MessageReplyHandler } from './comm.router';

//Export local.
export { MessageReplyHandler };

export declare type Route = {
    topic: Topic;
    handler: MessageReplyHandler;
}

export default class CommServer extends EventEmitter implements IServer {
    //Server Variables.
    public readonly name: string;
    public readonly port: number;

    //Handshake Topic
    private readonly _handshakeTopic: Topic;

    //MQTT Server
    private _commRouter: CommRouter;
    private _mqttServer: MqttServer;

    //Routes
    private readonly _publisherRoutes: Array<{publisher: typeof Publisher, routes: Array<Route>}>;
    private readonly _serviceRoutes: Array<Route>;
    private readonly _broadcastRoutes: Array<Topic>;
    
    //Handshake
    private _handshake: Handshake;

    //Default Constructor
    constructor(){
        //Call super for EventEmitter.
        super();

        //Init Server variables.
        this.name = global.service.name;
        this.port = Number(process.env.COM_PORT) || Defaults.COMM_PORT;

        //Init Broadcast Topic.
        this._handshakeTopic = Defaults.COMM_HANDSHAKE_TOPIC;

        //Init Router
        this._commRouter = new CommRouter();

        //Init Routes.
        this._publisherRoutes = new Array();
        this._serviceRoutes = new Array();
        this._broadcastRoutes = new Array();

        //Define Handshake
        this.defineBroadcast(this._handshakeTopic);
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public addPublisherRoute(topic: Topic, publisher: typeof Publisher, handler: MessageReplyHandler){
        //Sub function to add Publisher to _publisherRoutes
        const _addPublisherRoute = () => {
            //Create new routes.
            const routes = new Array({topic: topic, handler: handler});
    
            //Push Publisher & routes to _publisherRoutes.
            this._publisherRoutes.push({publisher: publisher, routes: routes});

            //Emit Publisher added event.
            this.emit(Events.COMM_SERVER_ADDED_PUBLISHER, publisher.name, publisher);
        }

        //Validate if _publisherRoutes is empty.
        if(this._publisherRoutes.length === 0){
            _addPublisherRoute();
        }else{
            //Find existing publisherRoute.
            const publisherRoute = this._publisherRoutes.find(stack => stack.publisher.name === publisher.name);

            if(publisherRoute){ //publisherRoute exists. 
                publisherRoute.routes.push({topic: topic, handler: handler});
            }else{  //No publisherRoute found.
                _addPublisherRoute();
            }
        }
    }

    private createServiceRoutes(){
        //Clone all routes to _serviceRoutes.
        this._commRouter.routes.messageReplys.forEach(route => {
            this._serviceRoutes.push(route);
        });

        //Get all routes from _publisherRoutes
        this._publisherRoutes.forEach(stack => {
            stack.routes.forEach(pRoute => {
                //Remove publisher routes from _serviceRoutes.
                this._serviceRoutes.splice(this._serviceRoutes.findIndex(sRoute => JSON.stringify(sRoute) === JSON.stringify(pRoute)), 1);
            });
        });
    }

    private createBroadcastRoutes(){
        this._commRouter.routes.broadcasts.forEach(broadcast => {
            this._broadcastRoutes.push(broadcast.topic);
        });
    }
    
    private setupHandshake(){
        const messageReply: Array<Topic> = new Array();
        this._commRouter.routes.messageReplys.forEach(route => {
            messageReply.push(route.topic);
        });

        //Define Handshake
        this._handshake = {
            name: this.name,
            messageReplys: messageReply,
            broadcasts: this._broadcastRoutes
        };
    }

    /////////////////////////
    ///////Connection Management
    /////////////////////////
    public async listen(){
        return new Promise<ConnectionState>((resolve, reject) => {
            //Load Service + Broadcast Routes + Handshake
            this.createServiceRoutes();
            this.createBroadcastRoutes();
            this.setupHandshake();

            //Start Server
            this._mqttServer = new MqttServer({ id: this.name, port: this.port });

            //Listen to events.
            this._mqttServer.on('ready', () => {
                //Pass control to router.
                this._commRouter.listen(this._mqttServer);

                //Pass router events to server.
                this._commRouter.on(Events.COMM_ROUTER_RECEIVED_PACKET, (topic: Topic, body: Body) => this.emit(Events.COMM_SERVER_RECEIVED_PACKET, topic, body));
                this._commRouter.on(Events.COMM_ROUTER_SENT_PACKET, (topic: Topic, body: Body) => this.emit(Events.COMM_SERVER_SENT_PACKET, topic, body));

                this.emit(Events.COMM_SERVER_STARTED, this);
                resolve(1);
            });

            this._mqttServer.on('subscribed', (topic: any, client: Client) => {
                //Handshake on _broadcastTopic.
                if(topic === this._handshakeTopic){
                    this.broadcast(this._handshakeTopic, this._handshake);
                }
            });
        });
    }

    public async close(){
        return new Promise<ConnectionState>((resolve, reject) => {
            this._mqttServer.close(() => {
                this.emit(Events.COMM_SERVER_STOPPED, this);
                resolve(0);
            });
        });
    }

    /////////////////////////
    ///////Report
    /////////////////////////
    public getReport(){
        //Sub function to create Routes.
        const _createRoutes = (routes: Array<Route>) => {
            let _routes = new Array();
            routes.forEach(route => {
                _routes.push({
                    fn: route.handler.name
                });
            });
            return _routes;
        }

        //New publishers
        let publishers: {[name: string]: Array<string>} = {};

        //Get stack from _publisherRoutes
        this._publisherRoutes.forEach(stack => {
            publishers[stack.publisher.name] = _createRoutes(stack.routes);
        });

        return {
            serviceRoutes: _createRoutes(this._serviceRoutes),
            publishers: publishers,
            broadcasts: this._broadcastRoutes
        }
    }

    /////////////////////////
    ///////Router Functions
    /////////////////////////
    public reply(topic: Topic, handler: MessageReplyHandler){
        this._commRouter.reply(topic, handler);
    }

    public defineBroadcast(topic: Topic){
        this._commRouter.defineBroadcast(topic);
    }

    public broadcast(topic: Topic, body: Body){
        this._commRouter.broadcast(topic, body);
    }
}