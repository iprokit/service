//Import modules
import EventEmitter from 'events';
import { Server as MqttServer, Client, Packet } from 'mosca';

export { MqttServer, Client, Packet };

//Local Imports
import { Server, Events, Defaults, ConnectionState } from './microservice';
import { Topic, Publisher, BroadcastMap, Broadcast } from './comm';
import CommRouter, { MessageReplyHandler } from './comm.router';
// import { Topic, Publisher, Broadcast, Comm } from './comm2';

//Export Local Imports.
export { MessageReplyHandler };

export declare type Route = {
    topic: Topic;
    handler: MessageReplyHandler;
}

export default class CommServer extends EventEmitter implements Server {
    //Server Variables.
    public readonly name: string;
    public readonly port: number;

    //Broadcast Topic
    private readonly _broadcastTopic: Topic;

    //MQTT Server
    private _commRouter: CommRouter;
    private _mqttServer: MqttServer;

    //Publishers
    private readonly _publisherRoutes: Array<{publisher: typeof Publisher, routes: Array<Route>}>;
    private readonly _serviceRoutes: Array<Route>;

    //Default Constructor
    constructor(){
        //Call super for EventEmitter.
        super();

        //Init Server variables.
        this.name = global.service.name;
        this.port = Number(process.env.COM_BROKER_PORT) || Defaults.COMM_PORT;

        //Init Broadcast Topic.
        this._broadcastTopic = Defaults.BROADCAST_TOPIC;

        //Init Router
        this._commRouter = new CommRouter();

        //Init Variables.
        this._publisherRoutes = new Array();
        this._serviceRoutes = new Array();

        //Add broadcast Route.
        this._commRouter.reply(this._broadcastTopic, (message, reply) => {
            const map: Array<BroadcastMap> = new Array();

            this._commRouter.routes.forEach(route => {
                if(route.topic !== this._broadcastTopic){
                    map.push({topic: route.topic});
                }
            });

            //Define Broadcast
            const broadcast: Broadcast = {name: this.name, map: map};
            reply.send(broadcast);
        });
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public addPublisherRoute(topic: Topic, publisher: typeof Publisher, handler: MessageReplyHandler){
        //Sub function to add Publisher to _publisherRoutes
        const _addPublisherRoute = () => {
            //Create new routes.
            const routes = new Array({ topic: topic, handler: handler });
    
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
                publisherRoute.routes.push({ topic: topic, handler: handler });
            }else{  //No publisherRoute found.
                _addPublisherRoute();
            }
        }
    }

    private createServiceRoutes(){
        //Clone all routes to _serviceRoutes.
        this._commRouter.routes.forEach(route => {
            this._serviceRoutes.push(route);
        })

        //Get all routes from _publisherRoutes
        this._publisherRoutes.forEach(stack => {
            stack.routes.forEach(pRoute => {
                //Remove publisher routes from _serviceRoutes.
                this._serviceRoutes.splice(this._serviceRoutes.findIndex(sRoute => JSON.stringify(sRoute) === JSON.stringify(pRoute)), 1);
            });
        });
    }

    /////////////////////////
    ///////Connection Management
    /////////////////////////
    public async listen(){
        return new Promise<ConnectionState>((resolve, reject) => {
            //Load Service Routes
            this.createServiceRoutes();

            //Start Server
            this._mqttServer = new MqttServer({ id: this.name, port: this.port });

            //Listen to events.
            this._mqttServer.on('ready', () => {
                this._commRouter.listen(this._mqttServer);
                this.emit(Events.COMM_SERVER_STARTED, this);
                resolve(1);
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
                _routes.push(route.handler.name);
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
            publishers: publishers
        }
    }

    /////////////////////////
    ///////Router Functions
    /////////////////////////
    public reply(topic: Topic, handler: MessageReplyHandler){
        this._commRouter.reply(topic, handler);
    }

    public defineAction(topic: Topic){
        this._commRouter.defineAction(topic);
    }

    public get action(){
        return this._commRouter.action;
    }
}