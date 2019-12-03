declare global {
    namespace NodeJS {
        interface Global {
            service: {
                name: string,
                version: string,
                expressPort: number,
                comBrokerPort: number,
                environment: string
            }
            projectPath: string
        }
    }
}

//Import modules
import express, { Request, Response, NextFunction } from 'express';
import { PathParams, RequestHandler } from 'express-serve-static-core';
import { Server } from 'http';
import cors from 'cors';
import httpStatus from 'http-status-codes';
import createError from 'http-errors';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

//Adding project path to global.
global.projectPath = path.dirname(require.main.filename);

//Local Imports
import Utility from './utility';
import Controller from './controller';
import CommBroker, { AutoInjectPublisherOptions, ReplyCallback, Publisher } from './comm.broker';
import CommMesh, { Alias } from './comm.mesh';
import DBManager, {DBInitOptions, InvalidConnectionOptionsError, EntityOptions} from './db.manager';
import RDBModel from './db.rdb.model';
import NoSQLModel from './db.nosql.model';

//Types: MicroServiceInitOptions
export type MicroServiceInitOptions = {
    name?: string,
    version?: string,
    url?: string,
    db?: DBInitOptions,
    autoInjectControllers?: AutoInjectControllerOptions,
    comm?: CommOptions
}

//Types: AutoInjectControllerOptions
export type AutoInjectControllerOptions = {
    paths?: Array<string>,
    likeName?: string,
    excludes?: Array<string>
};

//Types: CommOptions
export type CommOptions = {
    autoInjectPublishers?: AutoInjectPublisherOptions,
    mesh: Array<string>
}

//Types: MicroServiceOptions
export type MicroServiceOptions = {
    name: string,
    version: string,
    expressPort: number,
    comBrokerPort: number,
    environment: string,
    ip: string
}

//Interface: RequestResponseFunctionDescriptor
export interface RequestResponseFunctionDescriptor extends PropertyDescriptor {
    value?: RequestHandler;
}

//Types: RequestResponseFunction
export declare type RequestResponseFunction = (target: Object, propertyKey: string, descriptor: RequestResponseFunctionDescriptor) => void;

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
let dbManager: DBManager;
let commBroker: CommBroker;
let commMesh: CommMesh;

export default class MicroService {
    //Options
    private options: MicroServiceOptions;
    private initOptions: MicroServiceInitOptions;

    //Controllers
    private readonly controllers: Array<typeof Controller> = new Array<typeof Controller>();

    //Default Constructor
    public constructor(options?: MicroServiceInitOptions) {
        //Load options from constructor
        this.initOptions = options || {};

        //Load options
        this.loadDotEnvFile();
        this.loadServiceOptions();
        this.loadGlobalOptions();

        //Load express server, router
        this.initExpressServer();

        //Load user functions
        this.init();

        //Load DB
        dbManager = new DBManager();
        if(this.initOptions.db !== undefined){
            this.initDB(this.initOptions.db);
        }

        //Load Comm
        commBroker = new CommBroker();
        commMesh = new CommMesh();
        if(this.initOptions.comm !== undefined){
            this.initComm(this.initOptions.comm);
        }

        //Inject Controllers
        if(this.initOptions.autoInjectControllers !== undefined){
            this.autoInjectControllers(this.initOptions.autoInjectControllers);
        }

        //Load user controllers
        this.injectEndpoints();

        //Auto call, to create default/app endpoints.
        new MicroServiceController();
        MicroServiceController.microServiceOptions = this.getReport();//Pass report variables.

        //Start the server
        this.startService();
    }

    /////////////////////////
    ///////Gets/Sets
    /////////////////////////
    public getControllers(){
        return this.controllers;
    }

    public getOptions(){
        return this.options;
    }

    public getReport(){
        const baseURL = this.initOptions.url;

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
            init: this.options,
            controllers: controllers,
            routes: routes
        };
        return report;
    }

    /////////////////////////
    ///////User Functions
    /////////////////////////
    public init(){}

    public injectEndpoints(){}

    /////////////////////////
    ///////Load Functions
    /////////////////////////
    private loadDotEnvFile(){
        //Getting env file.
        const envPath = path.join(global.projectPath, '.env');
        if(fs.existsSync(envPath)){
            dotenv.config({path: envPath});
        }
    }

    private loadServiceOptions(){
        //Try loading options from package.json and process.env
        this.options = {
            name: this.initOptions.name || process.env.npm_package_name,
            version: this.initOptions.version || process.env.npm_package_version,
            expressPort: Number(process.env.EXPRESS_PORT) || 3000,
            comBrokerPort: Number(process.env.COM_BROKER_PORT) || 6000,
            environment: process.env.NODE_ENV || 'production',
            ip: Utility.getContainerIP()
        };
    }

    private loadGlobalOptions(){
        //Adding service variables to global.
        global.service = {
            name: this.options.name,
            version: this.options.version,
            expressPort: this.options.expressPort,
            comBrokerPort: this.options.comBrokerPort,
            environment: this.options.environment
        }
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    private initExpressServer() {
        //Setup Express
        expressApp.use(cors());
        expressApp.options('*', cors());
        expressApp.use(express.json());
        expressApp.use(express.urlencoded({extended: false}));
        //TODO: Add logging.

        //Setup Express Middlewares
        expressApp.use(this.proxyHandler());

        //Setup Router
        this.initOptions.url = (this.initOptions.url || '/' + this.options.name).toLowerCase();
        expressApp.use(this.initOptions.url, expressRouter);

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

    private initDB(dbOptions: DBInitOptions){
        try{
            //Init sequelize
            dbManager.init(dbOptions);
        }catch(error){
            if(error instanceof InvalidConnectionOptionsError){
                console.log(error.message);
            }else{
                console.error(error);
            }
            console.log('Will continue...');
        }
    }

    private initComm(commOptions: CommOptions){
        commBroker.init({autoInjectPublishers: commOptions.autoInjectPublishers});
        commMesh.init({mesh: commOptions.mesh});
    }

    /////////////////////////
    ///////Inject Functions
    /////////////////////////
    private autoInjectControllers(autoInjectOptions: AutoInjectControllerOptions){
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
    private startService() {
        const options = {
            version: this.options.version,
            environment: this.options.environment
        }
        console.log('%s : %o', this.options.name, options);
        console.log('Starting micro service...');

        //Parallel starting all components.
        const server = expressApp.listen(this.options.expressPort, () => {
            this.addExpressListeners(server);//Attach listeners
            console.log('Express server running on %s:%s%s', this.options.ip, this.options.expressPort, this.initOptions.url);
        });

        commBroker.listen()
            .then(() => {
                console.log('Comm broker broadcasting on %s:%s', this.options.ip, this.options.comBrokerPort);
            });

        commMesh.connect()
            .then(() => {
                console.log('Comm mesh connecting to nodes...');
            });

        dbManager.connect()
            .then((dbOptions: any) => {
                if(dbOptions !== undefined){
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
    }

    private stopService(server: Server){
        //Chained stopping all components.
        dbManager.disconnect()
            .then(() => {
                console.log('DB client disconnected.');
                commMesh.disconnect()
                    .then(() => {
                        console.log('Comm mesh disconnected.');
                        commBroker.close()
                            .then(() => {
                                console.log('Comm broker shutdown complete.');
                                server.close(() => {
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
            this.stopService(server)
        });

        process.on('SIGINT', () => {
            console.log('Recived SIGINT!');
            this.stopService(server);
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

    /////////////////////////
    ///////Custom Middlewares
    /////////////////////////
    public proxyHandler(){
        return (request: any, response: Response, next: NextFunction) => {
            //Generate Proxy object from headers.
            Utility.generateProxyObjects(request);
            next();
        }
    }
}

/////////////////////////
///////Component
/////////////////////////
export interface Component {
    init(initOptions: any): void;
    getOptions(): any;
    getReport(): any;
}

/////////////////////////
///////getNode Functions
/////////////////////////
export function getNode(name: string): Alias {
    return commMesh.getNodeAlias(name);
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
///////MicroService Controller
/////////////////////////
class MicroServiceController {
    public static microServiceOptions: any;

    @Get('/health', true)
    public getHealth(request: Request, response: Response) {
        response.status(httpStatus.OK).send({status: true});
    }

    @Get('/report', true)
    public getReport(request: Request, response: Response){
        try {
            const report = {
                status: true,
                service: MicroServiceController.microServiceOptions,
                db: dbManager.getReport(),
                commBroker: commBroker.getReport(),
                commMesh: commMesh.getReport()
            };
            response.status(httpStatus.OK).send(report);
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
        }
    }
}