//Defaults dictionary
export class Defaults {
    public static readonly ENVIRONMENT: string = 'production';
    public static readonly EXPRESS_PORT: number = 3000;
    public static readonly COMM_PORT: number = 6000;
    public static readonly BROADCAST_TOPIC: string = '/';
}

//Import modules
import { EventEmitter } from 'events';
import { PathParams, RequestHandler } from 'express-serve-static-core';
import httpStatus from 'http-status-codes';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

//Project path
export const projectPath = path.dirname(require.main.filename);

//Load Environment variables from .env file.
const envPath = path.join(projectPath, '.env');
if(fs.existsSync(envPath)){
    dotenv.config({path: envPath});
}

//Local Imports
import Utility from './utility';
import WWW from './www';
import CommBroker, { ReplyCallback, Publisher } from './comm.broker';
import CommMesh, { Alias } from './comm.mesh';
import DBManager, { InvalidConnectionOptionsError, DBTypes } from './db.manager';
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

//Interface: RequestResponseFunctionDescriptor
export interface RequestResponseFunctionDescriptor extends PropertyDescriptor {
    value?: RequestHandler;
}

//Types: RequestResponseFunction
export declare type RequestResponseFunction = (target: typeof Controller, propertyKey: string, descriptor: RequestResponseFunctionDescriptor) => void;

//Interface: ReplyFunctionDescriptor
interface ReplyFunctionDescriptor extends PropertyDescriptor {
    value?: ReplyCallback;
}

//Types: ReplyFunction
export declare type ReplyFunction = (target: typeof Publisher, propertyKey: string, descriptor: ReplyFunctionDescriptor) => void;

//Types: ModelClass
export declare type ModelClass = (target: typeof RDBModel | typeof NoSQLModel) => void;

//Types: RouteOptions
export type RouteOptions = {
    name: string,
    method: 'get' | 'post' | 'put' | 'delete',
    path: PathParams,
    fn: RequestHandler
}

//Types: EntityOptions.
export type EntityOptions = {
    name: string,
    attributes: any,
}

//Global Service Variables.
const www = new WWW();
const commBroker = new CommBroker();
const commMesh = new CommMesh();
const dbManager = new DBManager();

export default class MicroService extends EventEmitter {
    //Service Variables.
    public readonly serviceName: string;
    public readonly version: string;
    public readonly environment: string;
    public readonly ip: string;

    //AutoLoad Variables.
    private autoWireModelOptions: AutoLoadOptions;
    private autoInjectPublisherOptions: AutoLoadOptions;
    private autoInjectControllerOptions: AutoLoadOptions;

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

        const url = baseUrl || '/' + this.serviceName.toLowerCase();
        www.init(url);
        commBroker.init(this.serviceName);
        commMesh.init(this.serviceName);

        //Default Service Routes
        www.get('/health', (request, response, next) => {
            response.status(httpStatus.OK).send({status: true});
        });
        www.get('/report', (request, response, next) => {
            try {
                const report = {
                    status: true,
                    service: {
                        name: this.serviceName,
                        version: this.version,
                        ip: this.ip,
                        environment: this.environment
                    },
                    www: www.getReport(),
                    db: dbManager.getReport(),
                    commBroker: commBroker.getReport(),
                    commMesh: commMesh.getReport()
                };
                response.status(httpStatus.OK).send(report);
            } catch (error) {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
            }
        });

        this.addListeners();        
    }

    /////////////////////////
    ///////Init Functions
    /////////////////////////
    private initFiles(){
        let modelsOptions = (this.autoWireModelOptions === undefined) ? { includes: ['/'], excludes: undefined } : this.autoWireModelOptions;
        let publishersOptions = (this.autoInjectPublisherOptions === undefined) ? { includes: ['/'], excludes: undefined } : this.autoInjectPublisherOptions;
        let controllersOptions = (this.autoInjectControllerOptions === undefined) ? { includes: ['/'], excludes: undefined } : this.autoInjectControllerOptions;

        let modelFiles = new Array();
        let publisherFiles = new Array();
        let controllerFiles = new Array();

        let files = Utility.getFilePaths('/', { endsWith: '.js', excludes: ['index.js']});
        files.forEach(file => {
            const fileClass = require(file).default;

            try{
                if(fileClass.prototype instanceof RDBModel || fileClass.prototype instanceof NoSQLModel){
                    if((modelsOptions.includes && modelsOptions.includes.find(includedFile => file.includes(includedFile)))
                        || (modelsOptions.excludes && !modelsOptions.excludes.find(excludedFile => file.includes(excludedFile)))){
                            modelFiles.push(fileClass);
                    }
                }else if(fileClass.prototype instanceof Publisher){
                    if((publishersOptions.includes && publishersOptions.includes.find(includedFile => file.includes(includedFile)))
                        || (publishersOptions.excludes && !publishersOptions.excludes.find(excludedFile => file.includes(excludedFile)))){
                            publisherFiles.push(fileClass);
                    }
                }else if(fileClass.prototype instanceof Controller){
                    if((controllersOptions.includes && controllersOptions.includes.find(includedFile => file.includes(includedFile)))
                        || (controllersOptions.excludes && !controllersOptions.excludes.find(excludedFile => file.includes(excludedFile)))){
                            controllerFiles.push(fileClass);
                    }
                }
            }catch(error){
                //Ignore file.
            }
        });

        modelFiles.forEach(modelFile => {
            dbManager.initModel(modelFile);
        });
        publisherFiles.forEach(publisherFile => {
            commBroker.initPublisher(publisherFile);
        });
        controllerFiles.forEach(controllerFile => {
            www.initController(controllerFile);
        });
    }

    /////////////////////////
    ///////Call Functions
    /////////////////////////
    public useDB(type: DBTypes, paperTrail?: boolean){
        try{
            //Init sequelize
            dbManager.init(type, paperTrail);
        }catch(error){
            if(error instanceof InvalidConnectionOptionsError){
                console.log(error.message);
            }else{
                console.error(error);
            }
            console.log('Will continue...');
        }
    }

    public setAutoWireModelOptions(options?: AutoLoadOptions){
        this.autoWireModelOptions = options;
    }

    public setAutoInjectPublisherOptions(options?: AutoLoadOptions){
        this.autoInjectPublisherOptions = options;
    }

    public setAutoInjectControllerOptions(options?: AutoLoadOptions){
        this.autoInjectControllerOptions = options;
    }

    /////////////////////////
    ///////Service Functions
    /////////////////////////
    public start() {
        this.emit(Events.STARTING);

        this.initFiles();

        www.listen();
        commBroker.listen();
        commMesh.connect();
        try{
            dbManager.connect();
        }catch(error){
            if(error instanceof InvalidConnectionOptionsError){
                console.log(error.message);
            }else{
                console.error(error);
            }
            console.log('Will continue...');
        }
    }

    public stop(){
        //Chained stopping all components.
        this.emit(Events.STOPPING);
        dbManager.disconnect(() => {
            commMesh.disconnect(() => {
                commBroker.close(() => {
                    www.close(() => {
                        this.emit(Events.STOPPED);
                        process.exit(0);
                    })
                });
            });
        });
    }

    /////////////////////////
    ///////Listeners
    /////////////////////////
    private addListeners(){
        //Main listeners.
        process.on('SIGTERM', () => {
            this.stop()
        });

        process.on('SIGINT', () => {
            this.stop();
        });

        //Adding log listeners.
        this.on(Events.STARTING, () => {
            console.log('%s : %o', this.serviceName, {version: this.version, environment: this.environment});
            console.log('Starting micro service...');
        });
        
        this.on(Events.STOPPING, () => {
            console.log('Stopping micro service...');
        })

        www.on(Events.WWW_STARTED, (options) => {
            console.log('Express server running on %s:%s%s', this.ip, options.port, options.baseUrl);
        });

        www.on(Events.WWW_STOPPED, () => {
            console.log('Stopped Express.');
        });

        commBroker.on(Events.BROKER_STARTED, (options) => {
            console.log('Comm broker broadcasting on %s:%s', this.ip, options.port);
        });

        commBroker.on(Events.BROKER_STOPPED, () => {
            console.log('Stopped Broker.');
        });

        commMesh.on(Events.NODE_CONNECTED, (options) => {
            console.log('Node: Connected to %s', options.url);
        });

        commMesh.on(Events.NODE_DISCONNECTED, (options) => {
            console.log('Node: Disconnected from : %s', options.url);
        });

        dbManager.on(Events.DB_CONNECTED, (options) => {
            console.log('DB client connected to %s://%s/%s', options.type, options.host, options.name);
        });

        dbManager.on(Events.DB_DISCONNECTED, () => {
            console.log('DB Disconnected');
        });

        //Init
        www.on(Events.INIT_CONTROLLER, (name, controller) => {
            console.log('Adding endpoints from controller: %s', name);
        });

        commBroker.on(Events.INIT_PUBLISHER, (name, publisher) => {
            console.log('Mapping publisher: %s', name);
        });

        dbManager.on(Events.INIT_MODEL, (name, entityName, model) => {
            console.log('Initiating model: %s(%s)', name, entityName);
        });
    }
}

/////////////////////////
///////Events
/////////////////////////
export class Events {
    //Main
    public static readonly STARTING = Symbol('STARTING');
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
///////Component
/////////////////////////
export interface Component {
    getReport(): Object;
}

/////////////////////////
///////getNode Functions
/////////////////////////
export function getNode(url: string): Alias {
    return commMesh.getNodeAlias(url);
}

/////////////////////////
///////Router Decorators
/////////////////////////
export function Get(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (target, propertyKey, descriptor) => {
        if(!rootPath){
            const controllerName = target.constructor.name.replace('Controller', '').toLowerCase();
            path = ('/' + controllerName + path);
        }
        if(!target.routes){
            target.routes = new Array();
        }
        target.routes.push({name: propertyKey, method: 'get', path: path, fn: descriptor.value});
    }
}

export function Post(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (target, propertyKey, descriptor) => {
        if(!rootPath){
            const controllerName = target.constructor.name.replace('Controller', '').toLowerCase();
            path = ('/' + controllerName + path);
        }
        if(!target.routes){
            target.routes = new Array();
        }
        target.routes.push({name: propertyKey, method: 'post', path: path, fn: descriptor.value});
    }
}

export function Put(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (target, propertyKey, descriptor) => {
        if(!rootPath){
            const controllerName = target.constructor.name.replace('Controller', '').toLowerCase();
            path = ('/' + controllerName + path);
        }
        if(!target.routes){
            target.routes = new Array();
        }
        target.routes.push({name: propertyKey, method: 'put', path: path, fn: descriptor.value});
    }
}

export function Delete(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (target, propertyKey, descriptor) => {
        if(!rootPath){
            const controllerName = target.constructor.name.replace('Controller', '').toLowerCase();
            path = ('/' + controllerName + path);
        }
        if(!target.routes){
            target.routes = new Array();
        }
        target.routes.push({name: propertyKey, method: 'delete', path: path, fn: descriptor.value});
    }
}

/////////////////////////
///////Broker Decorators
/////////////////////////
export function Reply(): ReplyFunction {
    return (target, propertyKey, descriptor) => {
        const publisherName = target.constructor.name.replace('Publisher', '');
        const topic = Utility.convertToTopic(publisherName, propertyKey);

        if(!target.replies){
            target.replies = new Array();
        }
        target.replies.push({name: propertyKey, topic: topic, replyCB: descriptor.value});
    }
}

/////////////////////////
///////Entity Decorators
/////////////////////////
export function Entity(entityOptions: EntityOptions): ModelClass {
    return (target) => {
        target.entityName = entityOptions.name;
        target.entityAttributes = entityOptions.attributes;
    }
}