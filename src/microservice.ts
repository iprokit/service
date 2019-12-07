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
import CommBroker, { AutoInjectPublisherOptions, ReplyCallback, Publisher } from './comm.broker';
import CommMesh, { Alias } from './comm.mesh';
import DBManager, { InitOptions as DBInitOptions, InvalidConnectionOptionsError, EntityOptions, AutoWireModelOptions } from './db.manager';
import RDBModel from './db.rdb.model';
import NoSQLModel from './db.nosql.model';

//Types: Options
export type Options = {
    name?: string
    version?: string
}

//Types: AutoInjectControllerOptions
export type AutoInjectControllerOptions = {
    paths?: Array<string>,
    likeName?: string,
    excludes?: Array<string>
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

    /////////////////////////
    ///////Call Functions
    /////////////////////////
    public useDB(dbInitOptions: DBInitOptions){
        try{
            //Init sequelize
            dbManager.init(dbInitOptions);
        }catch(error){
            if(error instanceof InvalidConnectionOptionsError){
                console.log(error.message);
            }else{
                console.error(error);
            }
            console.log('Will continue...');
        }
    }

    public autoWireModels(autoInjectOptions: AutoWireModelOptions){
        dbManager.autoWireModels(autoInjectOptions)
    }

    public autoInjectPublishers(autoInjectOptions: AutoInjectPublisherOptions){
        commBroker.autoInjectPublishers(autoInjectOptions);
    }

    public autoInjectControllers(autoInjectOptions: AutoInjectControllerOptions){
        let paths = autoInjectOptions.paths || ['/'];
        const likeName = autoInjectOptions.likeName || 'controller.js';
        const excludes = autoInjectOptions.excludes || [];

        paths.forEach((path: string) => {
            let controllerPaths = Utility.getFilePaths(path, likeName, excludes);
            controllerPaths.forEach(controllerPath => {
                const _Controller = require(controllerPath).default;

                if(_Controller.prototype instanceof Controller){
                    const controller: typeof Controller = new _Controller();

                    console.log('Adding endpoints from controller: %s', controller.constructor.name);
    
                    //Add to Array
                    this.controllers.push(controller);
                }else{
                    console.log('Could not add endpoints from controller: %s', _Controller.constructor.name);
                }
            });
        });
    }

    /////////////////////////
    ///////Service Functions
    /////////////////////////
    public start() {
        this.emit(Events.STARTING);

        const options = {
            version: this.version,
            environment: this.environment
        }
        console.log('%s : %o', this.serviceName, options);
        console.log('Starting micro service...');

        //Parallel starting all components.
        const server = expressApp.listen(this.expressPort, () => {
            this.emit(Events.EXPRESS_STARTED);
            this.addExpressListeners(server);//Attach listeners
            console.log('Express server running on %s:%s%s', this.ip, this.expressPort, this.baseUrl);
        });

        commBroker.listen(this.serviceName)
            .then((commOptions: any) => {
                this.emit(Events.BROKER_STARTED);
                console.log('Comm broker broadcasting on %s:%s', this.ip, commOptions.port);
            });

        commMesh.connect(this.serviceName)
            .then(() => {
                this.emit(Events.MESH_CONNECTING);
                console.log('Comm mesh connecting to nodes...');
            });

        dbManager.connect()
            .then((dbOptions: any) => {
                if(dbOptions !== undefined){
                    this.emit(Events.DB_CONNECTED);
                    console.log('DB client connected to %s://%s/%s', dbOptions.type, dbOptions.host, dbOptions.name);
                }
            })
            .catch((error) => {
                if(error instanceof InvalidConnectionOptionsError){
                    console.log(error.message);
                }else{
                    console.error(error);
                }
                console.log('Will continue...');
            });
        this.emit(Events.STARTED);
    }

    public stop(server: Server){
        //Chained stopping all components.
        this.emit(Events.STOPPING);
        dbManager.disconnect()
            .then(() => {
                this.emit(Events.DB_DISCONNECTED);
                console.log('DB client disconnected.');
                commMesh.disconnect()
                    .then(() => {
                        this.emit(Events.MESH_DISCONNECTED);
                        console.log('Comm mesh disconnected.');
                        commBroker.close()
                            .then(() => {
                                this.emit(Events.BROKER_STOPPED);
                                console.log('Comm broker shutdown complete.');
                                server.close(() => {
                                    this.emit(Events.EXPRESS_STOPPED);
                                    this.emit(Events.STOPPED);
                                    console.log('Express server shutdown complete.');
                                    process.exit(0);
                                });
                            });
                    });
            });
    }

    /////////////////////////
    ///////Listeners
    /////////////////////////
    private addExpressListeners(server: Server){
        //Adding process listeners to stop server gracefully.
        process.on('SIGTERM', () => {
            console.log('Recived SIGTERM!');
            this.stop(server)
        });

        process.on('SIGINT', () => {
            console.log('Recived SIGINT!');
            this.stop(server);
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
    public static readonly STARTED = 'STARTED';
    public static readonly STOPPING = 'STOPPING';
    public static readonly STOPPED = 'STOPPED';

    //Express
    public static readonly EXPRESS_STARTED = 'EXPRESS_STARTED';
    public static readonly EXPRESS_STOPPED = 'EXPRESS_STOPPED';

    //Broker
    public static readonly BROKER_STARTED = 'BROKER_STARTED';
    public static readonly BROKER_STOPPED = 'BROKER_STOPPED';

    //Comm Mesh
    public static readonly MESH_CONNECTING = 'MESH_CONNECTING';
    public static readonly MESH_DISCONNECTED = 'MESH_DISCONNECTED';

    //DB
    public static readonly DB_CONNECTED = 'DB_CONNECTED';
    public static readonly DB_DISCONNECTED = 'DB_DISCONNECTED';

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