//Import modules
import EventEmitter from 'events';
import { Server as MqttServer, Packet, Client } from 'mosca';

//Local Imports
import { Server, Events, Defaults, ConnectionState } from './microservice';
import { Topic, Publisher, Broadcast, Comm } from './comm';
import CommRouter, { Method, CommHandler, MessageReplyHandler, MessageReplyTransactionHandler } from './comm.router';

//Export Local Imports.
export { CommHandler, MessageReplyHandler, MessageReplyTransactionHandler };

export declare type Route = {
    method: Method;
    topic: Topic;
    handler: CommHandler;
}

export default class CommServer extends EventEmitter implements Server {
    //Broker Variables.
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

        //Init Broker variables.
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
            const comms: Array<Comm> = new Array();

            this._commRouter.routes.forEach(comm => {
                if(comm.topic !== this._broadcastTopic){
                    comms.push({method: comm.method, topic: comm.topic});
                }
            });

            //Define Broadcast
            const broadcast: Broadcast = {name: this.name, comms: comms};

            reply.send(broadcast);
        });
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public addPublisherRoute(method: Method, topic: Topic, publisher: typeof Publisher, handler: CommHandler){
        //Sub function to add Publisher to _publisherRoutes
        const _addPublisherRoute = () => {
            //Create new routes.
            const routes = new Array({ method: method, topic: topic, handler: handler });
    
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
                publisherRoute.routes.push({method: method, topic: topic, handler: handler});
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
                _routes.push({
                    fn: route.handler.name,
                    [route.method.toUpperCase()]: route.topic
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
            publishers: publishers
        }
    }

    /////////////////////////
    ///////Router Functions
    /////////////////////////
    public reply(topic: Topic, handler: MessageReplyHandler){
        this._commRouter.reply(topic, handler);
    }

    public transaction(topic: Topic, handler: MessageReplyTransactionHandler){
        this._commRouter.transaction(topic, handler);
    }
}