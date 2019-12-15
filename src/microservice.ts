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
import { PathParams, RequestHandler } from 'express-serve-static-core';
import httpStatus from 'http-status-codes';
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
import WWW from './www';
import CommBroker, { ReplyCallback, Publisher } from './comm.broker';
import CommMesh, { Alias } from './comm.mesh';
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

        //Load global variables.
        global.service = {
            name: this.serviceName,
            projectPath: projectPath
        }

        //Init Components.
        www = new WWW(baseUrl);
        commBroker = new CommBroker();
        commMesh = new CommMesh();

        //Default Service Routes
        www.get('/health', (request, response, next) => {
            response.status(httpStatus.OK).send({status: true});
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
                    www: www.getReport(),
                    db: {},
                    commBroker: commBroker.getReport(),
                    commMesh: commMesh.getReport()
                };
                if(dbManager){
                    report.db = dbManager.getReport();
                }

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
    public useDB(type: Mongo | RDBDialect, paperTrail?: boolean){
        if(type === 'mongo'){
            dbManager = new NoSQLManager(paperTrail);
        }else{
            dbManager = new RDBManager(type as RDBDialect, paperTrail);
            //DO: Add sync route.
        }
    }

    /////////////////////////
    ///////DB Functions
    /////////////////////////
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
    public start(){
        this.emit(Events.STARTING);

        //Load files
        this.initFiles();

        //Validate if any node exits.
        let _commMeshConnect = () => {
            if(commMesh.hasNode()){
                return commMesh.connect()
            }
        };

        //Validate if dbManager exits.
        let _dbManagerConnect = () => {
            if(dbManager){
                return dbManager.connect()
            }
        }

        //Start all components
        Promise.all([www.listen(), commBroker.listen(), _commMeshConnect(), _dbManagerConnect()])
            .then(() => {
                this.emit(Events.STARTED);
            }).catch((error) => {
                if(error instanceof RDBConnectionOptionsError || error instanceof NoSQLConnectionOptionsError){
                    console.log(error.message);
                }else{
                    console.error(error);
                }
                console.log('Will continue...');
            });
    }

    public stop(){
        this.emit(Events.STOPPING);

        //Validate if any node exits.
        let _commMeshDisconnect = () => {
            if(commMesh.hasNode()){
                return commMesh.disconnect()
            }
        };

        //Validate if dbManager exits.
        let _dbManagerDisconnect = () => {
            if(dbManager){
                return dbManager.disconnect()
            }
        }

        //Stopping all components.
        Promise.all([www.close(), commBroker.close(), _commMeshDisconnect(), _dbManagerDisconnect()])
            .then(() => {
                this.emit(Events.STOPPED);
                process.exit(0);
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
                console.log('DB client connected to %s://%s/%s', _dbManager.dbType, _dbManager.dbHost, _dbManager.dbName);
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
export function Get(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (target, propertyKey, descriptor) => {
        www.addRoute('get', path, rootPath, descriptor.value, target);
    }
}

export function Post(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (target, propertyKey, descriptor) => {
        www.addRoute('post', path, rootPath, descriptor.value, target);
    }
}

export function Put(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (target, propertyKey, descriptor) => {
        www.addRoute('put', path, rootPath, descriptor.value, target);
    }
}

export function Delete(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (target, propertyKey, descriptor) => {
        www.addRoute('delete', path, rootPath, descriptor.value, target);
    }
}

/////////////////////////
///////Broker Decorators
/////////////////////////
export function Reply(): ReplyFunction {
    return (target, propertyKey, descriptor) => {
        commBroker.addReply(target, descriptor.value);
    }
}

/////////////////////////
///////Entity Decorators
/////////////////////////
export function Entity(entityOptions: EntityOptions): ModelClass {
    return (target: any) => {
        if(dbManager){
            dbManager.initModel(entityOptions.name, entityOptions.attributes, target);
        }
    }
}