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
import { EventEmitter } from 'events';
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
import WWW, { PathParams, RequestHandler, HttpCodes } from './www';
import CommBroker, { ReplyHandler, Publisher, Message as BrokerMessage, Reply as BrokerReply } from './comm.broker';
import CommMesh from './comm.mesh';
import CommNode, { Alias, Message as NodeMessage, Reply as NodeReply } from './comm.node';
import DBManager, { RDB, NoSQL, Type as DBType, Model, ModelAttributes, ConnectionOptionsError } from './db.manager';
import Controller from './controller';

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
let www: WWW;
let commBroker: CommBroker;
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
        www = new WWW(baseUrl);
        commBroker = new CommBroker();
        commMesh = new CommMesh();

        //Init AutoLoad Variables.
        autoWireModelOptions = { includes: ['*'], excludes: undefined };
        autoInjectPublisherOptions = { includes: ['*'], excludes: undefined };
        autoInjectControllerOptions = { includes: ['*'], excludes: undefined };

        //Default Service Routes
        www.get('/health', (request, response) => {
            response.status(HttpCodes.OK).send({status: true});
        });

        www.get('/report', (request, response) => {
            try {
                let report = {
                    service: {
                        name: this.serviceName,
                        version: this.version,
                        ip: this.ip,
                        wwwPort: www.port,
                        commPort: commBroker.port,
                        environment: this.environment
                    },
                    db: {},
                    routes: www.getReport(),
                    publishers: commBroker.getReport(),
                    mesh: commMesh.getReport()
                };
                if(dbManager){
                    report.db = dbManager.getReport();
                }

                response.status(HttpCodes.OK).send(report);
            } catch (error) {
                response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
            }
        });

        www.post('/shutdown', (request, response) => {
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
            www.post('/db/sync', async (request, response) => {
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
            await Promise.all([www.listen(), commBroker.listen()]);

            //Start client components
            await Promise.all([commMesh.connect(), (dbManager === undefined ? -1 : dbManager.connect())]);

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
            await Promise.all([www.close(), commBroker.close()]);

            //Stop client components
            await Promise.all([commMesh.disconnect(), (dbManager === undefined ? -1 : dbManager.disconnect())]);

            this.emit(Events.STOPPED);

            return 0;
        }catch(error){
            console.error(error);
        }
    }

    /////////////////////////
    ///////Router Functions
    /////////////////////////
    public all(path: PathParams, ...handlers: RequestHandler[]){
        www.all(path, ...handlers);
    }

    public get(path: PathParams, ...handlers: RequestHandler[]){
        www.get(path, ...handlers);
    }

    public post(path: PathParams, ...handlers: RequestHandler[]){
        www.post(path, ...handlers);
    }

    public put(path: PathParams, ...handlers: RequestHandler[]){
        www.put(path, ...handlers);
    }

    public delete(path: PathParams, ...handlers: RequestHandler[]){
        www.delete(path, ...handlers);
    }

    /////////////////////////
    ///////commBroker Functions
    /////////////////////////
    public reply(topic: string, replyHandler: ReplyHandler){
        commBroker.reply(topic, replyHandler);
    }

    /////////////////////////
    ///////commNode Functions
    /////////////////////////
    public defineNode(url: string, identifier: string){
        commMesh.defineNode(url, identifier)
    }

    public getAlias(identifier: string): Alias {
        return commMesh.getAlias(identifier);
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
        www.on(Events.WWW_STARTED, (_www: WWW) => console.log('Express server running on %s:%s%s', this.ip, _www.port, _www.baseUrl));
        www.on(Events.WWW_STOPPED, () => console.log('Stopped Express.'));
        www.on(Events.WWW_ADDED_CONTROLLER, (name: string, controller: Controller) => console.log('Added controller: %s', name));

        //commBroker
        commBroker.on(Events.BROKER_STARTED, (_commBroker: CommBroker) => console.log('Comm broker broadcasting on %s:%s', this.ip, _commBroker.port));
        commBroker.on(Events.BROKER_STOPPED, () => console.log('Stopped Broker.'));
        commBroker.on(Events.BROKER_ADDED_PUBLISHER, (name: string, publisher: Publisher) => console.log('Added publisher: %s', name));
        commBroker.on(Events.BROKER_RECEIVED_MESSAGE, (message: BrokerMessage) => console.log('Broker: received a message on topic: %s', message.topic));
        commBroker.on(Events.BROKER_SENT_REPLY, (reply: BrokerReply) => console.log('Broker: published a reply on topic: %s', reply.topic));

        //commMesh
        commMesh.on(Events.MESH_CONNECTING, () => console.log('Comm mesh connecting...'));
        commMesh.on(Events.MESH_CONNECTED, (_commMesh: CommMesh) => console.log('Comm mesh connected.'));
        commMesh.on(Events.MESH_DISCONNECTING, () => console.log('Comm mesh disconnecting...'));
        commMesh.on(Events.MESH_DISCONNECTED, (_commMesh: CommMesh) => console.log('Comm mesh disconnected.'));
        commMesh.on(Events.MESH_ADDED_NODE, (commNode: CommNode) => {

            //node
            commNode.on(Events.NODE_CONNECTED, (node: CommNode) => console.log('Node: Connected to %s', node.url));
            commNode.on(Events.NODE_DISCONNECTED, (node: CommNode) => console.log('Node: Disconnected from : %s', node.url));
            commNode.on(Events.NODE_SENT_MESSAGE, (message: NodeMessage) => console.log('Node: published a message on topic: %s', message.topic));
            commNode.on(Events.NODE_RECEIVED_REPLY, (reply: NodeReply) => console.log('Node: received a reply on topic: %s', reply.topic));
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

    //WWW
    public static readonly WWW_STARTED = Symbol('WWW_STARTED');
    public static readonly WWW_STOPPED = Symbol('WWW_STOPPED');
    public static readonly WWW_ADDED_CONTROLLER = Symbol('WWW_ADDED_CONTROLLER');

    //Broker
    public static readonly BROKER_STARTED = Symbol('BROKER_STARTED');
    public static readonly BROKER_STOPPED = Symbol('BROKER_STOPPED');
    public static readonly BROKER_ADDED_PUBLISHER = Symbol('BROKER_ADDED_PUBLISHER');
    public static readonly BROKER_RECEIVED_MESSAGE = Symbol('BROKER_RECEIVED_MESSAGE');
    public static readonly BROKER_SENT_REPLY = Symbol('BROKER_SENT_REPLY');

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
    public static readonly EXPRESS_PORT: number = 3000;
    public static readonly COMM_PORT: number = 6000;
    public static readonly BROADCAST_TOPIC: string = '/';
    public static readonly STOP_TIME: number = 5000;
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

/////////////////////////
///////export Functions
/////////////////////////
export function getAlias(identifier: string): Alias {
    return commMesh.getAlias(identifier);
}

export async function defineNodeAndGetAlias(url: string): Promise<Alias> {
    return await commMesh.defineNodeAndGetAlias(url);
}

export function getRDBConnection(): RDB {
    if(dbManager){
        return (dbManager.connection as RDB);
    }
}

export function getNoSQLConnection(): NoSQL {
    if(dbManager){
        return (dbManager.connection as NoSQL);
    }
}

//TODO: Optimize the below functions.

/////////////////////////
///////WWW Decorators
/////////////////////////
export interface RequestResponseFunctionDescriptor extends PropertyDescriptor {
    value?: RequestHandler;
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
            www.addControllerRoute('get', path, target, descriptor.value);
    
            //Call get
            www.get(path, descriptor.value);
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
            www.addControllerRoute('post', path, target, descriptor.value);
    
            //Call post
            www.post(path, descriptor.value);
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
            www.addControllerRoute('put', path, target, descriptor.value);
    
            //Call put
            www.put(path, descriptor.value);
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
            www.addControllerRoute('delete', path, target, descriptor.value);
    
            //Call delete
            www.delete(path, descriptor.value);
        }
    }
}

/////////////////////////
///////Broker Decorators
/////////////////////////
interface ReplyFunctionDescriptor extends PropertyDescriptor {
    value?: ReplyHandler;
}
export declare type ReplyFunction = (target: typeof Publisher, propertyKey: string, descriptor: ReplyFunctionDescriptor) => void;

export function Reply(): ReplyFunction {
    return (target, propertyKey, descriptor) => {
        const publisherName = target.name.replace('Publisher', '');

        if(canLoad(autoInjectPublisherOptions, publisherName)){
            const topic = Utility.convertToTopic(publisherName, propertyKey);
    
            //Add Comm
            commBroker.addComm(topic, target, descriptor.value);
    
            //Call reply.
            commBroker.reply(topic, descriptor.value);
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