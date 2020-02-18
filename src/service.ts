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
import express, { Express, Router, Request, Response, NextFunction } from 'express';
import { PathParams, RequestHandler } from 'express-serve-static-core';
import { Server as HttpServer } from 'http';
import cors from 'cors';
import createError from 'http-errors';
import HttpCodes from 'http-status-codes';

//Import @iprotechs Modules
import stscp, { Server as StscpServer, MessageReplyHandler, Body } from '@iprotechs/stscp';

//Load Environment variables from .env file.
const projectPath = path.dirname(require.main.filename);
const envPath = path.join(projectPath, '.env');
if(fs.existsSync(envPath)){
    dotenv.config({path: envPath});
}

//Local Imports
import Utility from './store/utility';
import CommMesh from './components/comm.mesh';
import CommNode from './components/comm.client';
import DBManager, { RDB, NoSQL, Type as DBType, Model, ModelAttributes, ConnectionOptionsError } from './components/db.manager';
import Controller from './generics/controller';
import { Publisher } from "./generics/publisher";
import { Alias } from "./generics/alias";
import { ConnectionState } from './store/component';

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

//API Server Variables.
let apiApp: Express;
let apiRouter: Router;
let apiServer: HttpServer;

//STSCP Variables.
let stscpServer: StscpServer;

//Component Variables.
let commMesh: CommMesh;
let dbManager: DBManager;

//AutoLoad Variables.
let autoWireModelOptions: AutoLoadOptions;
let autoInjectPublisherOptions: AutoLoadOptions;
let autoInjectControllerOptions: AutoLoadOptions;

export default class Service extends EventEmitter {
    //Service Variables.
    public readonly name: string;
    public readonly version: string;
    public readonly environment: string;
    public readonly ip: string;

    //API Server Variables.
    public readonly apiBaseUrl: string;
    public readonly apiPort: number;

    //STSCP Variables.
    public readonly stscpPort: number;

    //Default Constructor
    public constructor(baseUrl?: string, options?: Options) {
        //Call super for EventEmitter.
        super();

        //Set null defaults.
        options = options || {};

        //Init service variables.
        this.name = options.name || process.env.npm_package_name;
        this.version = options.version || process.env.npm_package_version;
        this.environment = process.env.NODE_ENV || Defaults.ENVIRONMENT;
        this.ip = Utility.getContainerIP();

        //Init API server variables.
        this.apiBaseUrl = baseUrl || '/' + this.name.toLowerCase();
        this.apiPort = Number(process.env.API_PORT) || Defaults.API_PORT;

        //Init STSCP variables.
        this.stscpPort = Number(process.env.STSCP_PORT) || Defaults.STSCP_PORT;

        //Load global variables.
        global.service = {
            name: this.name,
            projectPath: projectPath
        }

        //Init Components.
        this.initAPIServer();
        this.initSTSCP();
        commMesh = new CommMesh();

        //Init AutoLoad Variables.
        autoWireModelOptions = { includes: ['*'], excludes: undefined };
        autoInjectPublisherOptions = { includes: ['*'], excludes: undefined };
        autoInjectControllerOptions = { includes: ['*'], excludes: undefined };

        this.addProcessListeners();
    }

    /////////////////////////
    ///////Init Functions
    /////////////////////////
    private initAPIServer(){
        //Setup Express
        apiApp = express();
        apiApp.use(cors());
        apiApp.options('*', cors());
        apiApp.use(express.json());
        apiApp.use(express.urlencoded({ extended: false }));

        //Setup proxy pass.
        apiApp.use((request: Request, response: Response, next: NextFunction) => {
            //Generate Proxy object from headers.
            Utility.generateProxyObjects(request);
            next();
        });

        //Setup Router
        apiRouter = express.Router();
        apiApp.use(this.apiBaseUrl, apiRouter);

        // Error handler for 404
        apiApp.use((request: Request, response: Response, next: NextFunction) => {
            next(createError(404));
        });

        // Default error handler
        apiApp.use((error: any, request: Request, response: Response, next: NextFunction) => {
            response.locals.message = error.message;
            response.locals.error = request.app.get('env') === 'development' ? error : {};
            response.status(error.status || 500).send(error.message);
        });

        this.addDefaultRoutes();
    }

    private initSTSCP(){
        stscpServer = stscp.createServer(this.name);
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
    public useDB(type: DBType, paperTrail?: boolean){
        try{
            //Setup DBManager.
            dbManager = new DBManager(type, paperTrail);
            dbManager.init();
                
            //DB routes.
            apiRouter.post('/db/sync', async (request, response) => {
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
            //Start Server
            apiServer = apiApp.listen(this.apiPort, () => {
                this.emit(Events.API_SERVER_STARTED);
            });
            stscpServer.listen(this.stscpPort, () => {
                this.emit(Events.STSCP_SERVER_STARTED);
            });

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
            //Stop Server
            apiServer.close((error) => {
                if (!error) {
                    this.emit(Events.API_SERVER_STOPPED);
                }
            });
            stscpServer.close((error) => {
                if (!error) {
                    this.emit(Events.STSCP_SERVER_STOPPED);
                }
            });

            //Stop client components
            await Promise.all([commMesh.disconnect(), (dbManager  && dbManager.disconnect())]);

            this.emit(Events.STOPPED);

            return 0;
        }catch(error){
            console.error(error);
        }
    }

    /////////////////////////
    ///////API Server Functions
    /////////////////////////
    public all(path: PathParams, ...handlers: RequestHandler[]){
        apiRouter.all(path, ...handlers);
    }

    public get(path: PathParams, ...handlers: RequestHandler[]){
        apiRouter.get(path, ...handlers);
    }

    public post(path: PathParams, ...handlers: RequestHandler[]){
        apiRouter.post(path, ...handlers);
    }

    public put(path: PathParams, ...handlers: RequestHandler[]){
        apiRouter.put(path, ...handlers);
    }

    public delete(path: PathParams, ...handlers: RequestHandler[]){
        apiRouter.delete(path, ...handlers);
    }

    /////////////////////////
    ///////STSCP Server Functions
    /////////////////////////
    public reply(action: string, handler: MessageReplyHandler){
        stscpServer.reply(action, handler);
    }

    public defineBroadcast(action: string){
        stscpServer.defineBroadcast(action);
    }

    public static broadcast(action: string, body: Body){
        stscpServer.broadcast(action, body);
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
    ///////Other
    /////////////////////////
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

    private addDefaultRoutes(){
        //Default Service Routes
        apiRouter.get('/health', (request, response) => {
            response.status(HttpCodes.OK).send({status: true});
        });

        apiRouter.get('/report', (request, response) => {
            //Get API Routes.
            const apiRoutes = new Array();
            apiRouter.stack.forEach(item => {
                const functionName = item.route.stack[0].handle.name;
                const method = (item.route.stack[0].method === undefined) ? 'all' : item.route.stack[0].method;
                const path = this.apiBaseUrl + item.route.path;

                const route = {
                    function: functionName,
                    [method]: path
                }
                apiRoutes.push(route);
            });

            //Get STSCP Routes.
            const stscpRoutes = new Array();
            stscpServer.routes.forEach(item => {
                const route = {
                    [item.type]: item.action
                }
                stscpRoutes.push(route);
            });

            try {
                const report = {
                    service: {
                        name: this.name,
                        version: this.version,
                        ip: this.ip,
                        apiPort: this.apiPort,
                        stscpPort: this.stscpPort,
                        environment: this.environment
                    },
                    db: dbManager && dbManager.getReport(),
                    api: apiRoutes,
                    stscp: stscpRoutes,
                    mesh: commMesh.getReport()
                }

                response.status(HttpCodes.OK).send(report);
            } catch (error) {
                response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
            }
        });

        apiRouter.post('/shutdown', (request, response) => {
            response.status(HttpCodes.OK).send({status: true, message: "Will shutdown in 2 seconds..."});
            setTimeout(() => {
                console.log('Received shutdown from %s', request.url);
                process.kill(process.pid, 'SIGTERM');
            }, 2000);
        });
    }

    /////////////////////////
    ///////Listeners
    /////////////////////////
    public addListeners(){
        //Adding log listeners.
        this.on(Events.STARTING, () => console.log('Starting %s: %o', this.name, {version: this.version, environment: this.environment}));
        this.on(Events.STARTED, () => console.log('%s ready.', this.name));
        this.on(Events.STOPPING, () => console.log('Stopping %s...', this.name));
        this.on(Events.STOPPED, () => console.log('%s stopped.', this.name));

        //API Server
        this.on(Events.API_SERVER_STARTED, () => console.log('api server running on %s:%s%s', this.ip, this.apiPort, this.apiBaseUrl));
        this.on(Events.API_SERVER_STOPPED, () => console.log('Stopped api.'));
        // this.on(Events.API_SERVER_ADDED_CONTROLLER, (name: string, controller: Controller) => console.log('Added controller: %s', name));

        //STSCP Server
        this.on(Events.STSCP_SERVER_STARTED, () => console.log('Comm server running on %s:%s', this.ip, this.stscpPort));
        this.on(Events.STSCP_SERVER_STOPPED, () => console.log('Stopped Comm Server.'));
        // commServer.on(Events.COMM_SERVER_ADDED_PUBLISHER, (name: string, publisher: Publisher) => console.log('Added publisher: %s', name));
        // commServer.on(Events.COMM_SERVER_RECEIVED_PACKET, (topic: Topic, body: Body) => console.log('Server: received a packet on topic %s', topic));
        // commServer.on(Events.COMM_SERVER_SENT_PACKET, (topic: Topic, body: Body) => console.log('Server: sent a packet on topic %s', topic));

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
///////Defaults
/////////////////////////
export class Defaults {
    public static readonly ENVIRONMENT: string = 'production';
    public static readonly API_PORT: number = 3000;
    public static readonly STSCP_PORT: number = 6000;
    public static readonly STOP_TIME: number = 5000;
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
    //API Server
    public static readonly API_SERVER_STARTED = Symbol('API_SERVER_STARTED');
    public static readonly API_SERVER_STOPPED = Symbol('API_SERVER_STOPPED');
    // public static readonly API_SERVER_ADDED_CONTROLLER = Symbol('API_SERVER_ADDED_CONTROLLER');
    //STSCP Server
    public static readonly STSCP_SERVER_STARTED = Symbol('STSCP_SERVER_STARTED');
    public static readonly STSCP_SERVER_STOPPED = Symbol('STSCP_SERVER_STOPPED');
    // public static readonly COMM_SERVER_ADDED_PUBLISHER = Symbol('COMM_SERVER_ADDED_PUBLISHER');
    // public static readonly COMM_SERVER_RECEIVED_PACKET = Symbol('COMM_SERVER_RECEIVED_PACKET');
    // public static readonly COMM_SERVER_SENT_PACKET = Symbol('COMM_SERVER_SENT_PACKET');
    //Comm Router
    public static readonly COMM_ROUTER_RECEIVED_PACKET = Symbol('COMM_ROUTER_RECEIVED_PACKET');
    public static readonly COMM_ROUTER_SENT_PACKET = Symbol('COMM_ROUTER_SENT_PACKET');
    //Reply
    public static readonly COMM_ROUTER_SEND_REPLY = Symbol('COMM_ROUTER_SEND_REPLY');
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


//TODO: Optimize the below functions.

/////////////////////////
///////API Server Decorators
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

            apiRouter.get(path, descriptor.value);
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
    
            apiRouter.post(path, descriptor.value);
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
    
            apiRouter.put(path, descriptor.value);
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
    
            apiRouter.delete(path, descriptor.value);
        }
    }
}

/////////////////////////
///////Comm Server Decorators
/////////////////////////
interface MessageReplyDescriptor extends PropertyDescriptor {
    value: MessageReplyHandler;
}
export declare type MessageReplyFunction = (target: typeof Publisher, propertyKey: string, descriptor: MessageReplyDescriptor) => void;

export function Reply(): MessageReplyFunction {
    return (target, propertyKey, descriptor) => {
        const publisherName = target.name.replace('Publisher', '');

        if(canLoad(autoInjectPublisherOptions, publisherName)){
            const action = (publisherName + '.' + propertyKey);

            stscpServer.reply(action, descriptor.value);
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