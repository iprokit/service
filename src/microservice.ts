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
import Utility from './utility';
import Controller from './controller';
import CommBroker, { ReplyCallback, Publisher } from './comm.broker';
import CommMesh, { Alias } from './comm.mesh';
import DBManager, { InvalidConnectionOptionsError, DBTypes } from './db.manager';
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
const expressApp = express();
const expressRouter = express.Router();
const commBroker = new CommBroker();
const commMesh = new CommMesh();
const dbManager = new DBManager();

export default class MicroService extends EventEmitter implements Component {
    //Service Variables.
    public readonly serviceName: string;
    public readonly baseUrl: string;
    public readonly version: string;
    public readonly expressPort: number;
    public readonly environment: string;
    public readonly ip: string;

    //Controllers
    private readonly controllers: Array<typeof Controller>;

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

        //Load express, router
        this.initExpress();

        this.addListeners();        
    }

    /////////////////////////
    ///////Gets/Sets
    /////////////////////////
    public getReport(){
        //Get all routes
        let serviceRoutes = expressRouter.stack.map(item => {
            return {
                name: item.route.stack[0].name,
                method: item.route.stack[0].method,
                path: this.baseUrl + item.route.path
            };
        });

        //Get all controllers
        let controllers = this.controllers.map(controller => {
            let routes = controller.routes.map(route => {
                route.path = this.baseUrl + route.path; //Prepending baseURL.

                //Remove controller routes from serviceRoutes.
                serviceRoutes.splice(serviceRoutes.findIndex(sRoute => JSON.stringify(sRoute) === JSON.stringify(route)), 1);
                return route;
            })
            return {[controller.constructor.name]: routes};
        });

        return {
            init: {
                name: this.serviceName,
                version: this.version,
                ip: this.ip,
                port: this.expressPort,
                environment: this.environment
            },
            serviceRoutes: serviceRoutes,
            controllers: controllers
        }
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
        //DO: Implement init fn. Move this to seperate functions.
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
            this.initController(controllerFile);
        });
    }

    private initController(controller: any){
        const _controller: typeof Controller = new controller();
        this.emit(Events.INIT_CONTROLLER, _controller.constructor.name, _controller);

        _controller.routes.forEach(route => {
            if(route.method === 'get'){
                expressRouter.get(route.path, route.fn);
            }else if(route.method === 'post'){
                expressRouter.post(route.path, route.fn);
            }else if(route.method === 'put'){
                expressRouter.put(route.path, route.fn);
            }else if(route.method === 'delete'){
                expressRouter.delete(route.path, route.fn);
            }
        });
        this.controllers.push(_controller);
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