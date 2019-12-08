//Defaults dictionary
export class Defaults {
    public static readonly ENVIRONMENT: string = 'production';
    public static readonly EXPRESS_PORT: number = 3000;
    public static readonly COMM_PORT: number = 6000;
    public static readonly BROADCAST_TOPIC: string = '/';
}

//Import modules
import { EventEmitter } from 'events';
import express, { Request, Response, NextFunction } from 'express';
import { PathParams, RequestHandler } from 'express-serve-static-core';
import { Server } from 'http';
import cors from 'cors';
import httpStatus from 'http-status-codes';
import createError from 'http-errors';
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
import Utility, { FileOptions } from './utility';
import Controller from './controller';
import CommBroker, { ReplyCallback, Publisher, InvalidPublisher } from './comm.broker';
import CommMesh, { Alias } from './comm.mesh';
import DBManager, { InvalidConnectionOptionsError, EntityOptions, DBTypes, InvalidModel } from './db.manager';
import RDBModel from './db.rdb.model';
import NoSQLModel from './db.nosql.model';

//Types: Options
export type Options = {
    name?: string
    version?: string
}

//Types: AutoLoadOptions
export type AutoLoadOptions = {
    paths?: Array<string>,
    excludes?: Array<string>,
    startsWith?: string,
    endsWith?: string,
    likeName?: string
};

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

//Global Objects
const expressApp = express();
const expressRouter = express.Router();
const commBroker = new CommBroker();
const commMesh = new CommMesh();
const dbManager = new DBManager();

export default class MicroService extends EventEmitter implements Component{
    //Service Variables.
    public readonly serviceName: string;
    public readonly baseUrl: string;
    public readonly version: string;
    public readonly expressPort: number;
    public readonly environment: string;
    public readonly ip: string;

    //Controllers
    public readonly controllers: Array<typeof Controller>;

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
        this.baseUrl = baseUrl || '/' + this.serviceName.toLowerCase();
        this.version = options.version || process.env.npm_package_version;
        this.expressPort = Number(process.env.EXPRESS_PORT) || Defaults.EXPRESS_PORT;
        this.environment = process.env.NODE_ENV || Defaults.ENVIRONMENT;
        this.ip = Utility.getContainerIP();

        //Init Variables.
        this.controllers = new Array();

        //Init AutoLoad Variables.
        // this.autoWireModels(['/']);
        // this.autoInjectPublishers(['/']);
        // this.autoInjectControllers(['/']);

        //Load express, router
        this.initExpress();

        this.addListeners();        
    }

    /////////////////////////
    ///////Gets/Sets
    /////////////////////////
    public getReport(){
        const baseURL = this.baseUrl;

        let controllers = new Array();
        let routes = new Array();

        this.controllers.forEach((controller) => {
            controllers.push(controller.constructor.name);
        });

        //Getting all registered routes from router.
        expressRouter.stack.forEach((item: any) => {
            const method = item.route.stack[0].method;
            const url = baseURL + item.route.path;
            routes.push({method, url});
        });

        const report = {
            init: {
                name: this.serviceName,
                version: this.version,
                ip: this.ip,
                port: this.expressPort,
                environment: this.environment
            },
            controllers: controllers,
            routes: routes
        };
        return report;
    }

    /////////////////////////
    ///////Init Functions
    /////////////////////////
    private initExpress() {
        //Setup Express
        expressApp.use(cors());
        expressApp.options('*', cors());
        expressApp.use(express.json());
        expressApp.use(express.urlencoded({extended: false}));

        //Setup proxy pass.
        expressApp.use((request: any, response: Response, next: NextFunction) => {
            //Generate Proxy object from headers.
            Utility.generateProxyObjects(request);
            next();
        });

        //Setup Router
        expressApp.use(this.baseUrl, expressRouter);

        //Default Service Routes
        expressRouter.get('/health', (request, response, next) => {
            response.status(httpStatus.OK).send({status: true});
        });
        expressRouter.get('/report', (request, response, next) => {
            try {
                const report = {
                    status: true,
                    service: this.getReport(),
                    db: dbManager.getReport(),
                    commBroker: commBroker.getReport(),
                    commMesh: commMesh.getReport()
                };
                response.status(httpStatus.OK).send(report);
            } catch (error) {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
            }
        });

        // Error handler for 404
        expressApp.use((request: Request, response: Response, next: NextFunction) => {
            next(createError(404));
        });

        // Default error handler
        expressApp.use((error: any, request: Request, response: Response, next: NextFunction) => {
            response.locals.message = error.message;
            response.locals.error = request.app.get('env') === 'development' ? error : {};
            response.status(error.status || 500).send(error.message);
        });
    }

    private initFiles(){
        //TODO: Work from here.

        // let modelsOptions = this.autoInjectControllerOptions;
        // let publishersOptions = this.autoInjectPublisherOptions;
        // let controllersOptions = this.autoInjectControllerOptions;

        let path = '/';
        let options: FileOptions = {
            endsWith: '.js'
        }

        let files = Utility.getFilePaths(path, options);
        files.forEach(file => {
            const fileClass = require(file).default;
            
            try{
                if(fileClass.prototype instanceof RDBModel || fileClass.prototype instanceof NoSQLModel){
                    dbManager.initModel(fileClass);
                }else if(fileClass.prototype instanceof Controller){
                    this.initController(fileClass);
                }else if(fileClass.prototype instanceof Publisher){
                    commBroker.initPublisher(fileClass);
                }
            }catch(error){
                if(error instanceof InvalidController){
                    console.log('InvalidController');
                }else if(error instanceof InvalidModel){
                    console.log('InvalidModel');
                }else if(error instanceof InvalidPublisher){
                    console.log('InvalidPublisher');
                }else{
                    console.log('Some Error');
                }
            }
        });
    }

    private initController(controller: any){
        if(controller.prototype instanceof Controller){
            const _controller: typeof Controller = new controller();
            this.emit(Events.INIT_CONTROLLER, _controller.constructor.name, _controller);
            this.controllers.push(_controller);
        }else{
            throw new InvalidController(controller.constructor.name);
        }
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

    public autoWireModels(paths: Array<string>, options?: FileOptions){
        options = options || {};
        this.autoWireModelOptions = {
            paths: paths,
            excludes: options.excludes,
            startsWith: options.startsWith,
            endsWith: options.endsWith,
            likeName: options.likeName
        };
    }

    public autoInjectPublishers(paths: Array<string>, options?: FileOptions){
        options = options || {};
        this.autoInjectPublisherOptions = {
            paths: paths,
            excludes: options.excludes,
            startsWith: options.startsWith,
            endsWith: options.endsWith,
            likeName: options.likeName
        };
    }

    public autoInjectControllers(paths: Array<string>, options?: FileOptions){
        options = options || {};
        this.autoInjectControllerOptions = {
            paths: paths,
            excludes: options.excludes,
            startsWith: options.startsWith,
            endsWith: options.endsWith,
            likeName: options.likeName
        };
    }

    /////////////////////////
    ///////Service Functions
    /////////////////////////
    public start() {
        this.emit(Events.STARTING);

        this.initFiles();

        //Parallel starting all components.
        const server = expressApp.listen(this.expressPort, () => {
            //Adding process listeners to stop server gracefully.
            process.on('SIGTERM', () => {
                this.stop(server)
            });

            process.on('SIGINT', () => {
                this.stop(server);
            });
            this.emit(Events.EXPRESS_STARTED, {port: this.expressPort});
        });

        commBroker.listen(this.serviceName);
        commMesh.connect(this.serviceName);
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

    public stop(server: Server){
        //Chained stopping all components.
        this.emit(Events.STOPPING);
        dbManager.disconnect(() => {
            commMesh.disconnect(() => {
                commBroker.close(() => {
                    server.close(() => {
                        this.emit(Events.EXPRESS_STOPPED);
                        this.emit(Events.STOPPED);
                        process.exit(0);
                    });
                });
            });
        });
    }

    /////////////////////////
    ///////Listeners
    /////////////////////////
    private addListeners(){
        //Adding listeners.
        this.on(Events.STARTING, () => {
            console.log('%s : %o', this.serviceName, {version: this.version, environment: this.environment});
            console.log('Starting micro service...');
        });
        
        this.on(Events.STOPPING, () => {
            console.log('Stopping micro service...');
        })

        this.on(Events.EXPRESS_STARTED, (options) => {
            console.log('Express server running on %s:%s%s', this.ip, options.port, this.baseUrl);
        });

        this.on(Events.EXPRESS_STOPPED, () => {
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
        dbManager.on(Events.INIT_MODEL, (name, entityName, model) => {
            console.log('Initiating model: %s(%s)', name, entityName);
        });

        commBroker.on(Events.INIT_PUBLISHER, (name, publisher) => {
            console.log('Mapping publisher: %s', name);
        });

        this.on(Events.INIT_CONTROLLER, (name, controller) => {
            console.log('Adding endpoints from controller: %s', name);
        });
    }

    /////////////////////////
    ///////Router Functions
    /////////////////////////
    public all(path: PathParams, ...handlers: RequestHandler[]){
        expressRouter.all(path, ...handlers);
    }

    public get(path: PathParams, ...handlers: RequestHandler[]){
        expressRouter.get(path, ...handlers);
    }

    public post(path: PathParams, ...handlers: RequestHandler[]){
        expressRouter.post(path, ...handlers);
    }

    public put(path: PathParams, ...handlers: RequestHandler[]){
        expressRouter.put(path, ...handlers);
    }

    public delete(path: PathParams, ...handlers: RequestHandler[]){
        expressRouter.delete(path, ...handlers);
    }
}

/////////////////////////
///////Events
/////////////////////////
export class Events {
    //Main
    public static readonly STARTING = 'STARTING';
    public static readonly STOPPING = 'STOPPING';
    public static readonly STOPPED = 'STOPPED';

    //Express
    public static readonly EXPRESS_STARTED = 'EXPRESS_STARTED';
    public static readonly EXPRESS_STOPPED = 'EXPRESS_STOPPED';

    //Broker
    public static readonly BROKER_STARTED = 'BROKER_STARTED';
    public static readonly BROKER_STOPPED = 'BROKER_STOPPED';

    //Mesh
    public static readonly MESH_CONNECTING = 'MESH_CONNECTING';
    public static readonly MESH_DISCONNECTING = 'MESH_DISCONNECTING';
    public static readonly MESH_DISCONNECTED = 'MESH_DISCONNECTED';

    //Node
    public static readonly NODE_CONNECTED = 'NODE_CONNECTED';
    public static readonly NODE_DISCONNECTED = 'NODE_DISCONNECTED';

    //DB
    public static readonly DB_CONNECTED = 'DB_CONNECTED';
    public static readonly DB_DISCONNECTED = 'DB_DISCONNECTED';

    //Init
    public static readonly INIT_CONTROLLER = 'INIT_CONTROLLER';
    public static readonly INIT_MODEL = 'INIT_MODEL';
    public static readonly INIT_PUBLISHER = 'INIT_PUBLISHER';

}

/////////////////////////
///////Component
/////////////////////////
export interface Component {
    getReport(): any;
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
        expressRouter.get(path, descriptor.value);
    }
}

export function Post(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (target, propertyKey, descriptor) => {
        if(!rootPath){
            const controllerName = target.constructor.name.replace('Controller', '').toLowerCase();
            path = ('/' + controllerName + path);
        }
        expressRouter.post(path, descriptor.value);
    }
}

export function Put(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (target, propertyKey, descriptor) => {
        if(!rootPath){
            const controllerName = target.constructor.name.replace('Controller', '').toLowerCase();
            path = ('/' + controllerName + path);
        }
        expressRouter.put(path, descriptor.value);
    }
}

export function Delete(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (target, propertyKey, descriptor) => {
        if(!rootPath){
            const controllerName = target.constructor.name.replace('Controller', '').toLowerCase();
            path = ('/' + controllerName + path);
        }
        expressRouter.delete(path, descriptor.value);
    }
}

/////////////////////////
///////Broker Decorators
/////////////////////////
export function Reply(): ReplyFunction {
    return (target, propertyKey, descriptor) => {
        const publisherName = target.constructor.name.replace('Publisher', '');
        const topic = Utility.convertToTopic(publisherName, propertyKey);
        commBroker.reply(topic, descriptor.value);
    }
}

/////////////////////////
///////Entity Decorators
/////////////////////////
export function Entity(entityOptions: EntityOptions): ModelClass {
    return (target) => {
        target.entityOptions = entityOptions;
    }
}

/////////////////////////
///////Error Classes
/////////////////////////
export class InvalidController extends Error {
    constructor (name: string) {
        super('Could not initiatize controller: %s' + name);
        
        // Saving class name in the property of our custom error as a shortcut.
        this.name = this.constructor.name;
    
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
      }
}