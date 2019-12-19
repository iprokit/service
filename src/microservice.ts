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
import CommBroker, { ReplyHandler, Publisher } from './comm.broker';
import CommMesh from './comm.mesh';
import { Alias } from './comm.node';
import RDBManager, { RDBDialect, ConnectionOptionsError as RDBConnectionOptionsError } from './db.rdb.manager';
import NoSQLManager, { Mongo, ConnectionOptionsError as NoSQLConnectionOptionsError } from './db.nosql.manager';
import Controller from './controller';
import RDBModel from './db.rdb.model';
import NoSQLModel from './db.nosql.model';

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
let dbManager: RDBManager | NoSQLManager;

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
                    status: true,
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
        });
    }

    /////////////////////////
    ///////Call Functions
    /////////////////////////
    public useDB(type: Mongo | RDBDialect, paperTrail?: boolean){
        if(type === 'mongo'){
            dbManager = new NoSQLManager(paperTrail);
        }else{
            dbManager = new RDBManager(type as RDBDialect, paperTrail);
            
            //DB routes.
            www.post('/db/sync', async (request, response) => {
                try{
                    const sync = await(dbManager as RDBManager).sync(request.body.force);
                    response.status(HttpCodes.OK).send({ sync: sync, message: 'Database & tables synced!' });
                }catch(error){
                    response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
                }
            });
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
        //Console logs.
        this.addListeners();

        //Emit starting Event.
        this.emit(Events.STARTING);

        //Load files
        this.injectFiles();

        try{
            //Start server components
            await Promise.all([www.listen(), commBroker.listen()]);

            //Start client components
            await Promise.all([commMesh.connect(), (dbManager === undefined ? -1 : await dbManager.connect())]);

            this.emit(Events.STARTED);

            return 1;
        }catch(error){
            if(error instanceof RDBConnectionOptionsError || error instanceof NoSQLConnectionOptionsError){
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
            await Promise.all([commMesh.disconnect(), (dbManager === undefined ? -1 : await dbManager.disconnect())]);

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
    ///////Listeners
    /////////////////////////
    private addListeners(){
        //Adding log listeners.
        this.on(Events.STARTING, () => {
            console.log('Starting %s: %o', this.serviceName, {version: this.version, environment: this.environment});
        });

        this.on(Events.STARTED, () => {
            console.log('%s ready.', this.serviceName);
        });
        
        this.on(Events.STOPPING, () => {
            console.log('Stopping %s...', this.serviceName);
        });
        
        this.on(Events.STOPPED, () => {
            console.log('%s stopped.', this.serviceName);
        });

        //WWW
        www.on(Events.WWW_STARTED, (_www) => {
            console.log('Express server running on %s:%s%s', this.ip, _www.port, _www.baseUrl);
        });

        www.on(Events.WWW_STOPPED, () => {
            console.log('Stopped Express.');
        });

        www.on(Events.WWW_ADDED_CONTROLLER, (name, controller) => {
            console.log('Added controller: %s', name);
        });

        //commBroker
        commBroker.on(Events.BROKER_STARTED, (_commBroker) => {
            console.log('Comm broker broadcasting on %s:%s', this.ip, _commBroker.port);
        });

        commBroker.on(Events.BROKER_STOPPED, () => {
            console.log('Stopped Broker.');
        });

        commBroker.on(Events.BROKER_ADDED_PUBLISHER, (name, publisher) => {
            console.log('Added publisher: %s', name);
        });

        //commMesh
        commMesh.on(Events.MESH_CONNECTING, () => {
            console.log('Comm mesh connecting...');
        });

        commMesh.on(Events.MESH_CONNECTED, () => {
            console.log('Comm mesh connected.');
        });

        commMesh.on(Events.MESH_DISCONNECTING, () => {
            console.log('Comm mesh disconnecting...');
        });

        commMesh.on(Events.MESH_DISCONNECTED, () => {
            console.log('Comm mesh disconnected.');
        });

        commMesh.on(Events.NODE_CONNECTED, (_node) => {
            console.log('Node: Connected to %s', _node.url);
        });

        commMesh.on(Events.NODE_DISCONNECTED, (_node) => {
            console.log('Node: Disconnected from : %s', _node.url);
        });

        //dbManager
        if(dbManager){
            dbManager.on(Events.DB_CONNECTED, (_dbManager) => {
                console.log('DB client connected to %s://%s/%s', _dbManager.type, _dbManager.host, _dbManager.name);
            });

            dbManager.on(Events.DB_DISCONNECTED, () => {
                console.log('DB Disconnected');
            });

            dbManager.on(Events.DB_ADDED_MODEL, (name, entityName, model) => {
                console.log('Added model: %s(%s)', name, entityName);
            });
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

    //Mesh
    public static readonly MESH_CONNECTING = Symbol('MESH_CONNECTING');
    public static readonly MESH_CONNECTED = Symbol('MESH_CONNECTED');
    public static readonly MESH_DISCONNECTING = Symbol('MESH_DISCONNECTING');
    public static readonly MESH_DISCONNECTED = Symbol('MESH_DISCONNECTED');

    //Node
    public static readonly NODE_CONNECTED = Symbol('NODE_CONNECTED');
    public static readonly NODE_DISCONNECTED = Symbol('NODE_DISCONNECTED');

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
    public static readonly STOP_TIME: number = 2000;
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
///////getNode Functions
/////////////////////////
export function getNode(url: string): Alias {
    return commMesh.getNodeAlias(url);
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
export declare type ModelClass = (target: typeof RDBModel | typeof NoSQLModel) => void;
export type EntityOptions = {
    name: string,
    attributes: any,
}
export function Entity(entityOptions: EntityOptions): ModelClass {
    return (target) => {
        if(dbManager){
            const modelName = target.name.replace('Model', '');

            if(canLoad(autoWireModelOptions, modelName)){
                //Init Model.
                dbManager.initModel(modelName, entityOptions.name, entityOptions.attributes, (target as any));
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