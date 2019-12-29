//Global Variables.
declare global {
    namespace NodeJS {
        interface Global {
            service: {
                name: string,
                projectPath: string
            }
        }
    }
}

//Import Modules
import EventEmitter from 'events';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

//Load Environment variables from .env file.
const projectPath = path.dirname(require.main.filename);
const envPath = path.join(projectPath, '.env');
if(fs.existsSync(envPath)){
    dotenv.config({path: envPath});
}

//Local Imports
import Utility from './utility';
import WWWServer, { PathParams, RequestHandler, HttpCodes } from './www.server';
import { Topic, Body, Publisher } from './comm';
import CommServer, { MessageReplyHandler, TransactionHandler } from './comm.server';
import CommMesh from './comm.mesh';
import CommNode from './comm.node';
import DBManager, { RDB, NoSQL, Type as DBType, Model, ModelAttributes, ConnectionOptionsError } from './db.manager';
import Controller from './controller';
import { Alias } from './comm2';

//Types: Options
export type Options = {
    name?: string
    version?: string
}

//Types: AutoLoadOptions
export type AutoLoadOptions = {
    includes?: Array<string>,
    excludes?: Array<string>
}

//Component Variables.
let wwwServer: WWWServer;
let commServer: CommServer;
let commMesh: CommMesh;
let dbManager: DBManager;

//AutoLoad Variables.
let autoWireModelOptions: AutoLoadOptions;
let autoInjectPublisherOptions: AutoLoadOptions;
let autoInjectControllerOptions: AutoLoadOptions;

export default class MicroService extends EventEmitter {
    //Service Variables.
    public readonly serviceName: string;
    public readonly version: string;
    public readonly environment: string;
    public readonly ip: string;

    //Default Constructor
    public constructor(baseUrl?: string, options?: Options) {
        //Call super for EventEmitter.
        super();

        //Set null defaults.
        options = options || {};

        //Init service variables.
        this.serviceName = options.name || process.env.npm_package_name;
        this.version = options.version || process.env.npm_package_version;
        this.environment = process.env.NODE_ENV || Defaults.ENVIRONMENT;
        this.ip = Utility.getContainerIP();

        //Load global variables.
        global.service = {
            name: this.serviceName,
            projectPath: projectPath
        }

        //Init Components.
        wwwServer = new WWWServer(baseUrl);
        commServer = new CommServer();
        commMesh = new CommMesh();

        //Init AutoLoad Variables.
        autoWireModelOptions = { includes: ['*'], excludes: undefined };
        autoInjectPublisherOptions = { includes: ['*'], excludes: undefined };
        autoInjectControllerOptions = { includes: ['*'], excludes: undefined };

        //Default Service Routes
        wwwServer.get('/health', (request, response) => {
            response.status(HttpCodes.OK).send({status: true});
        });

        wwwServer.get('/report', (request, response) => {
            try {
                let report = {
                    service: {
                        name: this.serviceName,
                        version: this.version,
                        ip: this.ip,
                        wwwPort: wwwServer.port,
                        commPort: commServer.port,
                        environment: this.environment
                    },
                    db: dbManager && dbManager.getReport(),
                    www: wwwServer.getReport(),
                    comm: commServer.getReport(),
                    mesh: commMesh.getReport()
                };

                response.status(HttpCodes.OK).send(report);
            } catch (error) {
                response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
            }
        });

        wwwServer.post('/shutdown', (request, response) => {
            response.status(HttpCodes.OK).send({status: true, message: "Will shutdown in 2 seconds..."});
            setTimeout(() => {
                console.log('Received shutdown from %s', request.url);
                process.kill(process.pid, 'SIGTERM');
            }, 2000);
        });

        this.addProcessListeners();
    }

    /////////////////////////
    ///////Inject Functions
    /////////////////////////
    private injectFiles(){
        let files = Utility.getFilePaths('/', { endsWith: '.js', excludes: ['index.js']});
        files.forEach(file => {
            require(file).default;
        });
    }

    private addProcessListeners(){
        //Exit
        process.once('SIGTERM', async () => {
            console.log('Received SIGTERM.');
            let code = await this.stop();
            process.exit(code);
        });

        //Ctrl + C
        process.on('SIGINT', async () => {
            console.log('Received SIGINT.');
            let code = await this.stop();
            process.exit(code);
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('Caught: unhandledRejection', reason, promise);
            console.log('Will continue...');
        });
    }

    /////////////////////////
    ///////Call Functions
    /////////////////////////
    public useDB(type: DBType, paperTrail?: boolean){
        try{
            //Setup DBManager.
            dbManager = new DBManager(type, paperTrail);
            dbManager.init();
                
            //DB routes.
            wwwServer.post('/db/sync', async (request, response) => {
                try{
                    const sync = await dbManager.sync(request.body.force);
                    response.status(HttpCodes.OK).send({ sync: sync, message: 'Database & tables synced!' });
                }catch(error){
                    response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
                }
            });
        }catch(error){
            if(error instanceof ConnectionOptionsError){
                console.log(error.message);
            }else{
                console.error(error);
            }
            console.log('Will continue...');
        }
    }

    /////////////////////////
    ///////DB Functions
    /////////////////////////
    public setAutoWireModelOptions(options?: AutoLoadOptions){
        autoWireModelOptions = (options === undefined) ? autoWireModelOptions : options;
    }

    public setAutoInjectPublisherOptions(options?: AutoLoadOptions){
        autoInjectPublisherOptions = (options === undefined) ? autoInjectPublisherOptions : options;
    }

    public setAutoInjectControllerOptions(options?: AutoLoadOptions){
        autoInjectControllerOptions = (options === undefined) ? autoInjectControllerOptions : options;
    }

    /////////////////////////
    ///////Service Functions
    /////////////////////////
    public async start(): Promise<ConnectionState>{
        //Emit starting Event.
        this.emit(Events.STARTING);

        //Load files
        this.injectFiles();

        try{
            //Start server components
            await Promise.all([wwwServer.listen(), commServer.listen()]);

            //Start client components
            await Promise.all([commMesh.connect(), (dbManager && dbManager.connect())]);

            this.emit(Events.STARTED);

            return 1;
        }catch(error){
            if(error instanceof ConnectionOptionsError){
                console.log(error.message);
            }else{
                console.error(error);
            }
            console.log('Will continue...');
        }
    }

    public async stop(): Promise<ConnectionState>{
        this.emit(Events.STOPPING);

        setTimeout(() => {
            console.error('Forcefully shutting down.');
            return 1;
        }, Defaults.STOP_TIME);
        
        try{
            //Stop server components
            await Promise.all([wwwServer.close(), commServer.close()]);

            //Stop client components
            await Promise.all([commMesh.disconnect(), (dbManager  && dbManager.disconnect())]);

            this.emit(Events.STOPPED);

            return 0;
        }catch(error){
            console.error(error);
        }
    }

    /////////////////////////
    ///////WWW Server Functions
    /////////////////////////
    public all(path: PathParams, ...handlers: RequestHandler[]){
        wwwServer.all(path, ...handlers);
    }

    public get(path: PathParams, ...handlers: RequestHandler[]){
        wwwServer.get(path, ...handlers);
    }

    public post(path: PathParams, ...handlers: RequestHandler[]){
        wwwServer.post(path, ...handlers);
    }

    public put(path: PathParams, ...handlers: RequestHandler[]){
        wwwServer.put(path, ...handlers);
    }

    public delete(path: PathParams, ...handlers: RequestHandler[]){
        wwwServer.delete(path, ...handlers);
    }

    /////////////////////////
    ///////Comm Server Functions
    /////////////////////////
    public reply(topic: Topic, handler: MessageReplyHandler){
        commServer.reply(topic, handler);
    }

    public transaction(topic: Topic, handler: TransactionHandler){
        commServer.transaction(topic, handler);
    }

    public defineBroadcast(topic: Topic){
        commServer.defineBroadcast(topic);
    }

    public static broadcast(topic: Topic, body: Body){
        commServer.broadcast(topic, body);
    }

    /////////////////////////
    ///////Comm Mesh Functions
    /////////////////////////
    public defineNode(url: string, identifier: string){
        commMesh.defineNode(url, identifier);
    }

    //TODO: Convert this to dynamic object loader.
    public static getAlias(identifier: string): Alias {
        return commMesh.getAlias(identifier);
    }
    
    public static async defineNodeAndGetAlias(url: string): Promise<Alias> {
        return await commMesh.defineNodeAndGetAlias(url);
    }

    /////////////////////////
    ///////DB Manager Functions
    /////////////////////////
    public static get rdbConnection(): RDB {
        return dbManager && (dbManager.connection as RDB);
    }
    
    public static get noSQLConnection(): NoSQL {
        return dbManager && (dbManager.connection as NoSQL);
    }

    /////////////////////////
    ///////Listeners
    /////////////////////////
    public addListeners(){
        //Adding log listeners.
        this.on(Events.STARTING, () => console.log('Starting %s: %o', this.serviceName, {version: this.version, environment: this.environment}));
        this.on(Events.STARTED, () => console.log('%s ready.', this.serviceName));
        this.on(Events.STOPPING, () => console.log('Stopping %s...', this.serviceName));
        this.on(Events.STOPPED, () => console.log('%s stopped.', this.serviceName));

        //WWW
        wwwServer.on(Events.WWW_SERVER_STARTED, (_www: WWWServer) => console.log('www server running on %s:%s%s', this.ip, _www.port, _www.baseUrl));
        wwwServer.on(Events.WWW_SERVER_STOPPED, () => console.log('Stopped www.'));
        wwwServer.on(Events.WWW_SERVER_ADDED_CONTROLLER, (name: string, controller: Controller) => console.log('Added controller: %s', name));

        //commServer
        commServer.on(Events.COMM_SERVER_STARTED, (_commServer: CommServer) => console.log('Comm server running on %s:%s', this.ip, _commServer.port));
        commServer.on(Events.COMM_SERVER_STOPPED, () => console.log('Stopped Comm Server.'));
        commServer.on(Events.COMM_SERVER_ADDED_PUBLISHER, (name: string, publisher: Publisher) => console.log('Added publisher: %s', name));
        commServer.on(Events.COMM_SERVER_RECEIVED_PACKET, (topic: Topic, body: Body) => console.log('Server: received a packet on topic %s', topic));
        commServer.on(Events.COMM_SERVER_SENT_PACKET, (topic: Topic, body: Body) => console.log('Server: sent a packet on topic %s', topic));

        //commMesh
        commMesh.on(Events.MESH_CONNECTING, () => console.log('Comm mesh connecting...'));
        commMesh.on(Events.MESH_CONNECTED, (_commMesh: CommMesh) => console.log('Comm mesh connected.'));
        commMesh.on(Events.MESH_DISCONNECTING, () => console.log('Comm mesh disconnecting...'));
        commMesh.on(Events.MESH_DISCONNECTED, (_commMesh: CommMesh) => console.log('Comm mesh disconnected.'));
        commMesh.on(Events.MESH_ADDED_NODE, (commNode: CommNode) => {

            //commNode
            commNode.on(Events.NODE_CONNECTED, (node: CommNode) => console.log('Node: Connected to %s', node.url));
            commNode.on(Events.NODE_DISCONNECTED, (node: CommNode) => console.log('Node: Disconnected from : %s', node.url));
            //TODO: uncomment.
            // commNode.on(Events.NODE_SENT_MESSAGE, (message: CommMessage) => console.log('Node: published a message on topic: %s', message.topic));
            // commNode.on(Events.NODE_RECEIVED_REPLY, (reply: CommReply) => console.log('Node: received a reply on topic: %s', reply.topic));
        });

        //dbManager
        if(dbManager){
            dbManager.on(Events.DB_CONNECTED, (_dbManager: DBManager) => console.log('DB client connected to %s://%s/%s', _dbManager.type, _dbManager.host, _dbManager.name));
            dbManager.on(Events.DB_DISCONNECTED, () => console.log('DB Disconnected'));
            dbManager.on(Events.DB_ADDED_MODEL, (modelName: string, entityName: string, model: Model) => console.log('Added model: %s(%s)', modelName, entityName));
        }
    }
}

/////////////////////////
///////Events
/////////////////////////
export class Events {
    //TODO: Move this to appropriate classes.
    //Main
    public static readonly STARTING = Symbol('STARTING');
    public static readonly STARTED = Symbol('STARTED');
    public static readonly STOPPING = Symbol('STOPPING');
    public static readonly STOPPED = Symbol('STOPPED');

    //WWW Server
    public static readonly WWW_SERVER_STARTED = Symbol('WWW_SERVER_STARTED');
    public static readonly WWW_SERVER_STOPPED = Symbol('WWW_SERVER_STOPPED');
    public static readonly WWW_SERVER_ADDED_CONTROLLER = Symbol('WWW_SERVER_ADDED_CONTROLLER');

    //Comm Server
    public static readonly COMM_SERVER_STARTED = Symbol('COMM_SERVER_STARTED');
    public static readonly COMM_SERVER_STOPPED = Symbol('COMM_SERVER_STOPPED');
    public static readonly COMM_SERVER_ADDED_PUBLISHER = Symbol('COMM_SERVER_ADDED_PUBLISHER');
    public static readonly COMM_SERVER_RECEIVED_PACKET = Symbol('COMM_SERVER_RECEIVED_PACKET');
    public static readonly COMM_SERVER_SENT_PACKET = Symbol('COMM_SERVER_SENT_PACKET');

    //Comm Router
    public static readonly COMM_ROUTER_RECEIVED_PACKET = Symbol('COMM_ROUTER_RECEIVED_PACKET');
    public static readonly COMM_ROUTER_SENT_PACKET = Symbol('COMM_ROUTER_SENT_PACKET');

    //Reply
    public static readonly COMM_ROUTER_SEND_REPLY = Symbol('COMM_ROUTER_SEND_REPLY');

    //Transaction
    public static readonly COMM_ROUTER_TRANSACTION_PREPARE = Symbol('COMM_ROUTER_TRANSACTION_PREPARE');
    public static readonly COMM_ROUTER_TRANSACTION_COMMIT = Symbol('COMM_ROUTER_TRANSACTION_COMMIT');
    public static readonly COMM_ROUTER_TRANSACTION_ROLLBACK = Symbol('COMM_ROUTER_TRANSACTION_ROLLBACK');

    public static readonly COMM_ROUTER_TRANSACTION_PREPARED = Symbol('COMM_ROUTER_TRANSACTION_PREPARED');
    public static readonly COMM_ROUTER_TRANSACTION_COMMITTED = Symbol('COMM_ROUTER_TRANSACTION_COMMITTED');
    public static readonly COMM_ROUTER_TRANSACTION_ROLLEDBACK = Symbol('COMM_ROUTER_TRANSACTION_ROLLEDBACK');

    //Mesh
    public static readonly MESH_CONNECTING = Symbol('MESH_CONNECTING');
    public static readonly MESH_CONNECTED = Symbol('MESH_CONNECTED');
    public static readonly MESH_DISCONNECTING = Symbol('MESH_DISCONNECTING');
    public static readonly MESH_DISCONNECTED = Symbol('MESH_DISCONNECTED');
    public static readonly MESH_ADDED_NODE = Symbol('MESH_ADDED_NODE');

    //Node
    public static readonly NODE_CONNECTED = Symbol('NODE_CONNECTED');
    public static readonly NODE_DISCONNECTED = Symbol('NODE_DISCONNECTED');
    public static readonly NODE_RECEIVED_REPLY = Symbol('NODE_RECEIVED_REPLY');
    public static readonly NODE_SENT_MESSAGE = Symbol('NODE_SENT_MESSAGE');

    //DB
    public static readonly DB_CONNECTED = Symbol('DB_CONNECTED');
    public static readonly DB_DISCONNECTED = Symbol('DB_DISCONNECTED');
    public static readonly DB_ADDED_MODEL = Symbol('DB_ADDED_MODEL');
}

/////////////////////////
///////Defaults
/////////////////////////
export class Defaults {
    public static readonly ENVIRONMENT: string = 'production';
    public static readonly WWW_PORT: number = 3000;
    public static readonly COMM_PORT: number = 6000;
    public static readonly STOP_TIME: number = 5000;

    public static readonly COMM_HANDSHAKE_TOPIC: Topic = 'handshake';
    public static readonly COMM_PACKET_QOS: number = 0;
    public static readonly COMM_PACKET_RETAIN: boolean = false;

}

/////////////////////////
///////Components
/////////////////////////
/**
 * Connection States:
 * Disconnected = 0, Connected = 1, NoConnection = -1
 */
export type ConnectionState = 0 | 1 | -1;

export interface Server{
    getReport(): Object;
    listen(): Promise<ConnectionState>;
    close(): Promise<ConnectionState>;
}

export interface Client{
    getReport(): Object;
    connect(): Promise<ConnectionState>;
    disconnect(): Promise<ConnectionState>;
}

//TODO: Optimize the below functions.

/////////////////////////
///////WWW Server Decorators
/////////////////////////
export interface RequestResponseFunctionDescriptor extends PropertyDescriptor {
    value: RequestHandler;
}
export declare type RequestResponseFunction = (target: typeof Controller, propertyKey: string, descriptor: RequestResponseFunctionDescriptor) => void;
export function Get(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (target, propertyKey, descriptor) => {
        const controllerName = target.name.replace('Controller', '').toLowerCase();

        if(canLoad(autoInjectControllerOptions, controllerName)){
            if(!rootPath){
                path = ('/' + controllerName + path);
            }
    
            //Add Route
            wwwServer.addControllerRoute('get', path, target, descriptor.value);
    
            //Call get
            wwwServer.get(path, descriptor.value);
        }
    }
}

export function Post(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (target, propertyKey, descriptor) => {
        const controllerName = target.name.replace('Controller', '').toLowerCase();

        if(canLoad(autoInjectControllerOptions, controllerName)){
            if(!rootPath){
                path = ('/' + controllerName + path);
            }
    
            //Add Route
            wwwServer.addControllerRoute('post', path, target, descriptor.value);
    
            //Call post
            wwwServer.post(path, descriptor.value);
        }
    }
}

export function Put(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (target, propertyKey, descriptor) => {
        const controllerName = target.name.replace('Controller', '').toLowerCase();
        
        if(canLoad(autoInjectControllerOptions, controllerName)){
            if(!rootPath){
                path = ('/' + controllerName + path);
            }
    
            //Add Route
            wwwServer.addControllerRoute('put', path, target, descriptor.value);
    
            //Call put
            wwwServer.put(path, descriptor.value);
        }
    }
}

export function Delete(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (target, propertyKey, descriptor) => {
        const controllerName = target.name.replace('Controller', '').toLowerCase();

        if(canLoad(autoInjectControllerOptions, controllerName)){
            if(!rootPath){
                path = ('/' + controllerName + path);
            }
    
            //Add Route
            wwwServer.addControllerRoute('delete', path, target, descriptor.value);
    
            //Call delete
            wwwServer.delete(path, descriptor.value);
        }
    }
}

/////////////////////////
///////Comm Server Decorators
/////////////////////////
interface MessageReplyDescriptor extends PropertyDescriptor {
    value: MessageReplyHandler;
}
interface TransactionDescriptor extends PropertyDescriptor {
    value: TransactionHandler;
}
export declare type MessageReplyFunction = (target: typeof Publisher, propertyKey: string, descriptor: MessageReplyDescriptor) => void;
export declare type TransactionFunction = (target: typeof Publisher, propertyKey: string, descriptor: TransactionDescriptor) => void;

export function Reply(): MessageReplyFunction {
    return (target, propertyKey, descriptor) => {
        const publisherName = target.name.replace('Publisher', '');

        if(canLoad(autoInjectPublisherOptions, publisherName)){
            const topic = (publisherName + '/' + propertyKey);
    
            //Add Route
            commServer.addPublisherRoute('reply', topic, target, descriptor.value);
    
            //Call reply.
            commServer.reply(topic, descriptor.value);
        }
    }
}

export function Transaction(): TransactionFunction {
    return (target, propertyKey, descriptor) => {
        const publisherName = target.name.replace('Publisher', '');

        if(canLoad(autoInjectPublisherOptions, publisherName)){
            const topic = (publisherName + '/' + propertyKey);
    
            //Add Route
            commServer.addPublisherRoute('transaction', topic, target, descriptor.value);
    
            //Call transaction.
            commServer.transaction(topic, descriptor.value);
        }
    }
}

/////////////////////////
///////Entity Decorators
/////////////////////////
export declare type ModelClass = (target: Model) => void;
export type EntityOptions = {
    name: string,
    attributes: ModelAttributes,
}
export function Entity(entityOptions: EntityOptions): ModelClass {
    return (target) => {
        if(dbManager){
            const modelName = target.name.replace('Model', '');

            if(canLoad(autoWireModelOptions, modelName)){
                //Init Model.
                dbManager.initModel(modelName, entityOptions.name, entityOptions.attributes, target);
            }
        }
    }
}

/////////////////////////
///////Decorator Helpers
/////////////////////////
function canLoad(injectOptions: AutoLoadOptions, search: string) {
    //Sub function for validating *
    const _validateAll = (list: Array<string>) => {
        return list.includes('*') && list.length === 1;
    }

    //Sub function for validating list
    const _validateOne = (list: Array<string>, search: string) => {
        return list.find(key => key.toLowerCase() === search.toLowerCase());
    }

    if(injectOptions.includes){
        if(_validateAll(injectOptions.includes)){
            return true;
        }
        if(_validateOne(injectOptions.includes, search)){
            return true;
        }
        return false;
    }else if(injectOptions.excludes){
        if(_validateAll(injectOptions.excludes)){
            return false;
        }
        if(!_validateOne(injectOptions.excludes, search)){
            return true;
        }
        return false;
    }
    return false;
}