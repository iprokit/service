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
import Promise from 'bluebird';
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
import WWW, { WWWHandler, WWWPathParams } from './www';
import CommBroker, { ReplyHandler, Publisher } from './comm.broker';
import CommMesh, { Alias } from './comm.mesh';
import RDBManager, { RDBDialect, ConnectionOptionsError as RDBConnectionOptionsError } from './db.rdb.manager';
import NoSQLManager, { Mongo, ConnectionOptionsError as NoSQLConnectionOptionsError } from './db.nosql.manager';
import Controller, { HttpCodes } from './controller';
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

//Interface: RequestResponseFunctionDescriptor
export interface RequestResponseFunctionDescriptor extends PropertyDescriptor {
    value?: WWWHandler;
}

//Types: RequestResponseFunction
export declare type RequestResponseFunction = (target: typeof Controller, propertyKey: string, descriptor: RequestResponseFunctionDescriptor) => void;

//Interface: ReplyFunctionDescriptor
interface ReplyFunctionDescriptor extends PropertyDescriptor {
    value?: ReplyHandler;
}

//Types: ReplyFunction
export declare type ReplyFunction = (target: typeof Publisher, propertyKey: string, descriptor: ReplyFunctionDescriptor) => void;

//Types: ModelClass
export declare type ModelClass = (target: typeof RDBModel | typeof NoSQLModel) => void;

//Types: EntityOptions.
export type EntityOptions = {
    name: string,
    attributes: any,
}

//Global Service Variables.
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
        www.get('/health', (request, response, next) => {
            response.status(HttpCodes.OK).send({status: true});
        });
        www.get('/report', (request, response, next) => {
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

        //Console logs.
        this.addListeners();
        
        this.emit(Events.STARTING);
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

    /////////////////////////
    ///////Call Functions
    /////////////////////////
    public useDB(type: Mongo | RDBDialect, paperTrail?: boolean){
        if(type === 'mongo'){
            dbManager = new NoSQLManager(paperTrail);
        }else{
            dbManager = new RDBManager(type as RDBDialect, paperTrail);
            //TODO: Add sync route.
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
    public start(){
        //Load files
        this.injectFiles();

        //Start all components
        Promise.all([www.listen(), commBroker.listen()])
            .then(() => {
                this.emit(Events.STARTED);
                if(commMesh.hasNode()){
                    commMesh.connect()
                        .catch(error => {
                            console.error(error);
                            console.log('Will continue...');
                        });
                }
                if(dbManager){
                    dbManager.connect()
                        .catch(error => {
                            if(error instanceof RDBConnectionOptionsError || error instanceof NoSQLConnectionOptionsError){
                                console.log(error.message);
                            }else{
                                console.error(error);
                            }
                            console.log('Will continue...');
                        });
                }
            }).catch((error) => {
                console.error(error);
                console.log('Will continue...');
            });
    }

    public stop(){
        this.emit(Events.STOPPING);

        //Stopping all components.
        Promise.all([www.close(), commBroker.close()])
            .then(() => {
                if(commMesh.hasNode()){
                    commMesh.disconnect();
                }
                if(dbManager){
                    dbManager.disconnect();
                }
                //TODO fix the order.
                this.emit(Events.STOPPED);
                process.exit(0);
            }).catch((error) => {
                process.exit(1);
            });

        setTimeout(() => {
            console.error('Forcefully shutting down.');
            process.exit(1);
        }, 2000);
    }

    /////////////////////////
    ///////Router Functions
    /////////////////////////
    public all(path: WWWPathParams, ...handlers: WWWHandler[]){
        www.all(path, ...handlers);
    }

    public get(path: WWWPathParams, ...handlers: WWWHandler[]){
        www.get(path, ...handlers);
    }

    public post(path: WWWPathParams, ...handlers: WWWHandler[]){
        www.post(path, ...handlers);
    }

    public put(path: WWWPathParams, ...handlers: WWWHandler[]){
        www.put(path, ...handlers);
    }

    public delete(path: WWWPathParams, ...handlers: WWWHandler[]){
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
        //Main listeners.
        process.on('SIGTERM', () => {
            //Kill
            this.stop();
        });

        process.on('SIGINT', () => {
            //Ctrl + C
            this.stop();
        });

        // process.on('unhandledRejection', (reason, promise) => {
        //     console.log('caught --', reason, promise);
        // });

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

        www.on(Events.WWW_STARTED, (_www) => {
            console.log('Express server running on %s:%s%s', this.ip, _www.port, _www.baseUrl);
        });

        www.on(Events.WWW_STOPPED, () => {
            console.log('Stopped Express.');
        });

        commBroker.on(Events.BROKER_STARTED, (_commBroker) => {
            console.log('Comm broker broadcasting on %s:%s', this.ip, _commBroker.port);
        });

        commBroker.on(Events.BROKER_STOPPED, () => {
            console.log('Stopped Broker.');
        });

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

        if(dbManager){
            dbManager.on(Events.DB_CONNECTED, (_dbManager) => {
                console.log('DB client connected to %s://%s/%s', _dbManager.type, _dbManager.host, _dbManager.name);
            });

            dbManager.on(Events.DB_DISCONNECTED, () => {
                console.log('DB Disconnected');
            });
        }

        // //Init
        // www.on(Events.INIT_CONTROLLER, (name, controller) => {
        //     console.log('Adding endpoints from controller: %s', name);
        // });

        // commBroker.on(Events.INIT_PUBLISHER, (name, publisher) => {
        //     console.log('Mapping publisher: %s', name);
        // });

        // // dbManager.on(Events.INIT_MODEL, (name, entityName, model) => {
        // //     console.log('Initiating model: %s(%s)', name, entityName);
        // // });
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

    //Broker
    public static readonly BROKER_STARTED = Symbol('BROKER_STARTED');
    public static readonly BROKER_STOPPED = Symbol('BROKER_STOPPED');

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

    //Init
    public static readonly INIT_CONTROLLER = Symbol('INIT_CONTROLLER');
    public static readonly INIT_MODEL = Symbol('INIT_MODEL');
    public static readonly INIT_PUBLISHER = Symbol('INIT_PUBLISHER');
}

/////////////////////////
///////Defaults
/////////////////////////
export class Defaults {
    public static readonly ENVIRONMENT: string = 'production';
    public static readonly EXPRESS_PORT: number = 3000;
    public static readonly COMM_PORT: number = 6000;
    public static readonly BROADCAST_TOPIC: string = '/';
}

/////////////////////////
///////Components
/////////////////////////
export interface Server{
    getReport(): Object;
    listen(): Promise<boolean>;
    close(): Promise<boolean>;
}

export interface Client{
    getReport(): Object;
    connect(): Promise<boolean>;
    disconnect(): Promise<boolean>;
}

/////////////////////////
///////getNode Functions
/////////////////////////
export function getNode(url: string): Alias {
    return commMesh.getNodeAlias(url);
}

/////////////////////////
///////WWW Decorators
/////////////////////////
export function Get(path: WWWPathParams, rootPath?: boolean): RequestResponseFunction {
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

export function Post(path: WWWPathParams, rootPath?: boolean): RequestResponseFunction {
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

export function Put(path: WWWPathParams, rootPath?: boolean): RequestResponseFunction {
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

export function Delete(path: WWWPathParams, rootPath?: boolean): RequestResponseFunction {
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
export function Entity(entityOptions: EntityOptions): ModelClass {
    return (target: any) => {
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
    const _validateStar = (list: Array<string>) => {
        return list.includes('*') && list.length === 1;
    }

    //Sub function for validating list
    const _validateList = (list: Array<string>, search: string) => {
        return list.find(key => key.toLowerCase() === search.toLowerCase());
    }

    if(injectOptions.includes){
        if(_validateStar(injectOptions.includes)){
            return true;
        }
        if(_validateList(injectOptions.includes, search)){
            return true;
        }
        return false;
    }else if(injectOptions.excludes){
        if(_validateStar(injectOptions.excludes)){
            return false;
        }
        if(!_validateList(injectOptions.excludes, search)){
            return true;
        }
        return false;
    }
    return false;
}