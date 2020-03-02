//Global Variables.
declare global {
    namespace NodeJS {
        interface Global {
            service: {
                projectPath: string
            }
        }
    }
}

//Import @iprotechs Modules
import stscp, { Server as StscpServer, ClientManager as StscpClientManager, MessageReplyHandler, Body, Mesh } from '@iprotechs/stscp';

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

//Load Environment variables from .env file.
const projectPath = path.dirname(require.main.filename);
const envPath = path.join(projectPath, '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

//Local Imports
import Utility from './utility';
import Publisher from './stscp.publisher';
import Controller from './api.controller';
import DBManager, { RDB, NoSQL, Type as DBType, Model, ModelAttributes, ConnectionOptionsError } from './db.manager';

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
let dbManager: DBManager;

//STSCP Variables.
let stscpServer: StscpServer;
let stscpClientManager: StscpClientManager;

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
            projectPath: projectPath
        }

        //Init Components.
        this.initAPIServer();
        this.initSTSCP();

        //Init AutoLoad Variables.
        autoWireModelOptions = { includes: ['*'], excludes: undefined };
        autoInjectPublisherOptions = { includes: ['*'], excludes: undefined };
        autoInjectControllerOptions = { includes: ['*'], excludes: undefined };

        this.addProcessListeners();
    }

    /////////////////////////
    ///////Init Functions
    /////////////////////////
    private initAPIServer() {
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

    private initSTSCP() {
        stscpServer = stscp.createServer(this.name);
        stscpClientManager = stscp.createClientManager(this.name);
    }

    /////////////////////////
    ///////Inject Functions
    /////////////////////////
    private injectFiles() {
        let files = Utility.getFilePaths('/', { endsWith: '.js', excludes: ['index.js'] });
        files.forEach(file => {
            require(file).default;
        });
    }

    /////////////////////////
    ///////Call Functions
    /////////////////////////
    public useDB(type: DBType, paperTrail?: boolean) {
        try {
            //Setup DBManager.
            dbManager = new DBManager(type, paperTrail);
            dbManager.init();

            //DB routes.
            apiRouter.post('/db/sync', async (request, response) => {
                try {
                    const sync = await dbManager.sync(request.body.force);
                    response.status(HttpCodes.OK).send({ sync: sync, message: 'Database & tables synced!' });
                } catch (error) {
                    response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
                }
            });
        } catch (error) {
            if (error instanceof ConnectionOptionsError) {
                console.log(error.message);
            } else {
                console.error(error);
            }
            console.log('Will continue...');
        }
    }

    /////////////////////////
    ///////DB Functions
    /////////////////////////
    public setAutoWireModelOptions(options?: AutoLoadOptions) {
        autoWireModelOptions = (options === undefined) ? autoWireModelOptions : options;
    }

    public setAutoInjectPublisherOptions(options?: AutoLoadOptions) {
        autoInjectPublisherOptions = (options === undefined) ? autoInjectPublisherOptions : options;
    }

    public setAutoInjectControllerOptions(options?: AutoLoadOptions) {
        autoInjectControllerOptions = (options === undefined) ? autoInjectControllerOptions : options;
    }

    /////////////////////////
    ///////Service Functions
    /////////////////////////
    public async start() {
        //Emit starting Event.
        this.emit(Events.STARTING);

        //Load files
        this.injectFiles();

        try {
            //Start Servers
            apiServer = apiApp.listen(this.apiPort, () => {
                this.emit(Events.API_SERVER_STARTED);
            });
            stscpServer.listen(this.stscpPort, () => {
                this.emit(Events.STSCP_SERVER_STARTED);
            });

            //Start client components
            stscpClientManager.connect((mesh: Mesh) => {
                this.emit(Events.STSCP_CLIENT_MANAGER_CONNECTED);
            });
            dbManager && dbManager.connect();

            this.emit(Events.STARTED);

            return 1;
        } catch (error) {
            if (error instanceof ConnectionOptionsError) {
                console.log(error.message);
            } else {
                console.error(error);
            }
            console.log('Will continue...');
        }
    }

    public async stop() {
        this.emit(Events.STOPPING);

        setTimeout(() => {
            console.error('Forcefully shutting down.');
            return 1;
        }, Defaults.FORCE_STOP_TIME);

        try {
            //Stop Servers
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
            stscpClientManager.disconnect(() => {
                this.emit(Events.STSCP_CLIENT_MANAGER_DISCONNECTED);
            });
            dbManager && dbManager.disconnect();

            this.emit(Events.STOPPED);

            return 0;
        } catch (error) {
            console.error(error);
        }
    }

    /////////////////////////
    ///////API Server Functions
    /////////////////////////
    public all(path: PathParams, ...handlers: RequestHandler[]) {
        apiRouter.all(path, ...handlers);
    }

    public get(path: PathParams, ...handlers: RequestHandler[]) {
        apiRouter.get(path, ...handlers);
    }

    public post(path: PathParams, ...handlers: RequestHandler[]) {
        apiRouter.post(path, ...handlers);
    }

    public put(path: PathParams, ...handlers: RequestHandler[]) {
        apiRouter.put(path, ...handlers);
    }

    public delete(path: PathParams, ...handlers: RequestHandler[]) {
        apiRouter.delete(path, ...handlers);
    }

    /////////////////////////
    ///////STSCP Server Functions
    /////////////////////////
    public reply(action: string, handler: MessageReplyHandler) {
        stscpServer.reply(action, handler);
    }

    public defineBroadcast(action: string) {
        stscpServer.defineBroadcast(action);
    }

    public static broadcast(action: string, body: Body) {
        stscpServer.broadcast(action, body);
    }

    /////////////////////////
    ///////STSCP Client Manager Functions
    /////////////////////////
    public defineNode(url: string, nodeName: string) {
        stscpClientManager.createClient(url, nodeName);
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
    private addProcessListeners() {
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

    private addDefaultRoutes() {
        //Default Service Routes
        apiRouter.get('/health', (request, response) => {
            response.status(HttpCodes.OK).send({ status: true });
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

            //Get STSCP Clients.
            const mesh = new Array();
            stscpClientManager.clients.forEach(item => {
                const client = {
                    id: item.node.id,
                    name: item.node.name,
                    host: item.host,
                    port: item.port,
                    connected: item.connected,
                    reconnecting: item.reconnecting,
                    disconnected: item.disconnected,
                    node: {
                        broadcasts: item.broadcasts,
                        replies: item.replies
                    }
                };
                mesh.push(client);
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
                    mesh: mesh
                }

                response.status(HttpCodes.OK).send(report);
            } catch (error) {
                response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
            }
        });

        apiRouter.post('/shutdown', (request, response) => {
            response.status(HttpCodes.OK).send({ status: true, message: "Will shutdown in 2 seconds..." });
            setTimeout(() => {
                console.log('Received shutdown from %s', request.url);
                process.kill(process.pid, 'SIGTERM');
            }, 2000);
        });
    }

    /////////////////////////
    ///////Listeners
    /////////////////////////
    public addListeners() {
        //Adding log listeners.
        this.on(Events.STARTING, () => console.log('Starting %s: %o', this.name, { version: this.version, environment: this.environment }));
        this.on(Events.STARTED, () => console.log('%s ready.', this.name));
        this.on(Events.STOPPING, () => console.log('Stopping %s...', this.name));
        this.on(Events.STOPPED, () => console.log('%s stopped.', this.name));

        //API Server
        this.on(Events.API_SERVER_STARTED, () => console.log('API server running on %s:%s%s', this.ip, this.apiPort, this.apiBaseUrl));
        this.on(Events.API_SERVER_STOPPED, () => console.log('Stopped API server.'));
        // this.on(Events.API_SERVER_ADDED_CONTROLLER, (name: string, controller: Controller) => console.log('Added controller: %s', name));

        //STSCP Server
        this.on(Events.STSCP_SERVER_STARTED, () => console.log('STSCP server running on %s:%s', this.ip, this.stscpPort));
        this.on(Events.STSCP_SERVER_STOPPED, () => console.log('Stopped STSCP Server.'));
        // commServer.on(Events.COMM_SERVER_ADDED_PUBLISHER, (name: string, publisher: Publisher) => console.log('Added publisher: %s', name));

        //STSCP Client Manager
        this.on(Events.STSCP_CLIENT_MANAGER_CONNECTED, () => console.log('STSCP client manager connected.'));
        this.on(Events.STSCP_CLIENT_MANAGER_DISCONNECTED, () => console.log('STSCP client manager disconnected.'));
        // this.on(Events.MESH_ADDED_NODE, (commNode: CommNode) => {

        //     //commNode
        //     commNode.on(Events.NODE_CONNECTED, (node: CommNode) => console.log('Node: Connected to %s', node.url));
        //     commNode.on(Events.NODE_DISCONNECTED, (node: CommNode) => console.log('Node: Disconnected from : %s', node.url));
        // });

        //dbManager
        if (dbManager) {
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
    public static readonly FORCE_STOP_TIME: number = 5000;
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

    //STSCP Client Manager
    public static readonly STSCP_CLIENT_MANAGER_CONNECTED = Symbol('STSCP_CLIENT_MANAGER_CONNECTED');
    public static readonly STSCP_CLIENT_MANAGER_DISCONNECTED = Symbol('STSCP_CLIENT_MANAGER_DISCONNECTED');
    // public static readonly MESH_ADDED_NODE = Symbol('MESH_ADDED_NODE');

    // //Node
    // public static readonly NODE_CONNECTED = Symbol('NODE_CONNECTED');
    // public static readonly NODE_DISCONNECTED = Symbol('NODE_DISCONNECTED');

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

        if (canLoad(autoInjectControllerOptions, controllerName)) {
            if (!rootPath) {
                path = ('/' + controllerName + path);
            }

            apiRouter.get(path, descriptor.value);
        }
    }
}

export function Post(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (target, propertyKey, descriptor) => {
        const controllerName = target.name.replace('Controller', '').toLowerCase();

        if (canLoad(autoInjectControllerOptions, controllerName)) {
            if (!rootPath) {
                path = ('/' + controllerName + path);
            }

            apiRouter.post(path, descriptor.value);
        }
    }
}

export function Put(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (target, propertyKey, descriptor) => {
        const controllerName = target.name.replace('Controller', '').toLowerCase();

        if (canLoad(autoInjectControllerOptions, controllerName)) {
            if (!rootPath) {
                path = ('/' + controllerName + path);
            }

            apiRouter.put(path, descriptor.value);
        }
    }
}

export function Delete(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (target, propertyKey, descriptor) => {
        const controllerName = target.name.replace('Controller', '').toLowerCase();

        if (canLoad(autoInjectControllerOptions, controllerName)) {
            if (!rootPath) {
                path = ('/' + controllerName + path);
            }

            apiRouter.delete(path, descriptor.value);
        }
    }
}

/////////////////////////
///////STSCP Server Decorators
/////////////////////////
interface MessageReplyDescriptor extends PropertyDescriptor {
    value: MessageReplyHandler;
}
export declare type MessageReplyFunction = (target: typeof Publisher, propertyKey: string, descriptor: MessageReplyDescriptor) => void;

export function Reply(): MessageReplyFunction {
    return (target, propertyKey, descriptor) => {
        const publisherName = target.name.replace('Publisher', '');

        if (canLoad(autoInjectPublisherOptions, publisherName)) {
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
        if (dbManager) {
            const modelName = target.name.replace('Model', '');

            if (canLoad(autoWireModelOptions, modelName)) {
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

    if (injectOptions.includes) {
        if (_validateAll(injectOptions.includes)) {
            return true;
        }
        if (_validateOne(injectOptions.includes, search)) {
            return true;
        }
        return false;
    } else if (injectOptions.excludes) {
        if (_validateAll(injectOptions.excludes)) {
            return false;
        }
        if (!_validateOne(injectOptions.excludes, search)) {
            return true;
        }
        return false;
    }
    return false;
}