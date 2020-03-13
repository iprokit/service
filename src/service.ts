//Import @iprotechs Modules
import { Server as StscpServer, ClientManager as StscpClientManager, Client as StscpClient, Mesh as StscpMesh, MessageReplyHandler, Body } from '@iprotechs/stscp';

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
import Helper from './helper';
import Publisher from './stscp.publisher';
import Controller from './api.controller';
import DBManager, { RDB, NoSQL, Type as DBType, Model, ModelAttributes, ConnectionOptionsError } from './db.manager';

//API Server Variables.
let apiApp: Express;
let apiRouter: Router;
let apiServer: HttpServer;
let dbManager: DBManager;

//STSCP Variables.
let stscpServer: StscpServer;
let stscpClientManager: StscpClientManager;
export const Mesh: StscpMesh = StscpClientManager.mesh;

//AutoLoad Variables.
let autoWireModelOptions: AutoLoadOptions;
let autoInjectPublisherOptions: AutoLoadOptions;
let autoInjectControllerOptions: AutoLoadOptions;

/**
 * @emits starting
 * @emits ready
 * @emits stopping
 * @emits stopped
 * @emits apiServerStarted
 * @emits apiServerStopped
 * @emits stscpServerStarted
 * @emits stscpServerStopped
 * @emits stscpClientManagerConnected
 * @emits stscpClientManagerDisconnected
 * @emits stscpClientConnected
 * @emits stscpClientDisconnected
 * @emits stscpClientReconnecting
 * @emits dbConnected
 * @emits dbDisconnected
 */
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
        this.ip = Helper.getContainerIP();

        //Init API server variables.
        this.apiBaseUrl = baseUrl || '/' + this.name.toLowerCase();
        this.apiPort = Number(process.env.API_PORT) || Defaults.API_PORT;

        //Init STSCP variables.
        this.stscpPort = Number(process.env.STSCP_PORT) || Defaults.STSCP_PORT;

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
            Helper.generateProxyObjects(request);
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
        stscpServer = new StscpServer(this.name);
        stscpClientManager = new StscpClientManager(this.name);

        //Bind Events for stscpClientManager
        stscpClientManager.on('clientConnected', (client: StscpClient) => this.emit('stscpClientConnected', client));
        stscpClientManager.on('clientDisconnected', (client: StscpClient) => this.emit('stscpClientDisconnected', client));
        stscpClientManager.on('clientReconnecting', (client: StscpClient) => this.emit('stscpClientReconnecting', client));
    }

    /////////////////////////
    ///////Inject Functions
    /////////////////////////
    private injectFiles() {
        const options = {
            endsWith: '.js',
            excludes: ['index.js', 'git', 'node_modules', 'package.json', 'package-lock.json', '.babelrc', '.env']
        }

        const files = Helper.getFilePaths(path.join(projectPath, '/'), options);
        files.forEach(file => {
            require(file).default;
        });
    }

    /////////////////////////
    ///////DB Functions
    /////////////////////////
    public useDB(type: DBType, paperTrail?: boolean) {
        try {
            //Setup DB Manager.
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
    ///////Service Functions
    /////////////////////////
    public start(callback?: () => void) {
        //Emit Global: starting.
        this.emit('starting');

        //Load files
        this.injectFiles();

        //Start API Server
        apiServer = apiApp.listen(this.apiPort, () => {
            //Emit Global: apiServerStarted.
            this.emit('apiServerStarted');

            //Start STSCP Server
            stscpServer.listen(this.stscpPort, () => {
                //Emit Global: stscpServerStarted.
                this.emit('stscpServerStarted');

                //Start STSCP Client Manager
                stscpClientManager.connect(() => {
                    //Emit Global: stscpClientManagerConnected.
                    this.emit('stscpClientManagerConnected');
                });

                //Start DB Manager
                dbManager && dbManager.connect((error) => {
                    if (!error) {
                        //Emit Global: dbConnected.
                        this.emit('dbConnected');
                    } else {
                        if (error instanceof ConnectionOptionsError) {
                            console.log(error.message);
                        } else {
                            console.error(error);
                        }
                        console.log('Will continue...');
                    }
                });

                //Emit Global: ready.
                this.emit('ready');

                //Callback.
                if (callback) {
                    callback();
                }
            });
        });
    }

    public stop(callback: (exitCode: number) => void) {
        //Emit Global: stopping.
        this.emit('stopping');

        setTimeout(() => {
            callback(1);
            console.error('Forcefully shutting down.');
        }, Defaults.FORCE_STOP_TIME);

        //Stop API Servers
        apiServer.close((error) => {
            if (!error) {
                //Emit Global: apiServerStopped.
                this.emit('apiServerStopped');
            }

            //Stop STSCP Servers
            stscpServer.close((error) => {
                if (!error) {
                    //Emit Global: stscpServerStopped.
                    this.emit('stscpServerStopped');
                }

                //Stop STSCP Client Manager
                stscpClientManager.disconnect(() => {
                    //Emit Global: stscpClientManagerDisconnected.
                    this.emit('stscpClientManagerDisconnected');

                    //Stop DB Manager
                    dbManager && dbManager.disconnect((error) => {
                        if (!error) {
                            //Emit Global: dbDisconnected.
                            this.emit('dbDisconnected');
                        }

                        //Emit Global: stopped.
                        this.emit('stopped');

                        //Callback.
                        callback(0);
                    });
                });
            });
        });
    }

    /////////////////////////
    ///////Call Functions
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
        process.once('SIGTERM', () => {
            console.log('Received SIGTERM.');
            this.stop((exitCode: number) => {
                process.exit(exitCode);
            });
        });

        //Ctrl + C
        process.on('SIGINT', () => {
            console.log('Received SIGINT.');
            this.stop((exitCode: number) => {
                process.exit(exitCode);
            });
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
                    db: dbManager && this.getDBReport(),
                    api: this.apiRouteReport(),
                    stscp: this.stscpRouteReport(),
                    mesh: this.stscpMeshReport()
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

    public getDBReport() {
        //New Models Dict.
        let models: { [name: string]: string } = {};

        //Gets models.
        if (dbManager.noSQL) {
            dbManager.models.forEach(model => models[model.name] = model.collection.name);
        } else {
            dbManager.models.forEach(model => models[model.name] = model.tableName);
        }

        return {
            name: dbManager.name,
            host: dbManager.host,
            type: dbManager.type,
            connected: dbManager.connected,
            models: models
        }
    }

    private apiRouteReport() {
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
        return apiRoutes;
    }

    private stscpRouteReport() {
        //Get STSCP Routes.
        const stscpRoutes = new Array();
        stscpServer.routes.forEach(item => {
            const route = {
                [item.type]: item.action
            }
            stscpRoutes.push(route);
        });
        return stscpRoutes;
    }

    private stscpMeshReport() {
        //Get STSCP Clients.
        const mesh = new Array();
        stscpClientManager.clients.forEach(item => {
            const client = {
                name: item.node.name,
                host: item.host,
                port: item.port,
                connected: item.connected,
                reconnecting: item.reconnecting,
                disconnected: item.disconnected,
                node: {
                    id: item.node.id,
                    broadcasts: item.broadcasts,
                    replies: item.replies
                }
            };
            mesh.push(client);
        });
        return mesh;
    }

    /////////////////////////
    ///////Listeners
    /////////////////////////
    public addListeners() {
        //Service
        this.on('starting', () => console.log('Starting %s: %o', this.name, { version: this.version, environment: this.environment }));
        this.on('ready', () => console.log('%s ready.', this.name));
        this.on('stopping', () => console.log('Stopping %s...', this.name));
        this.on('stopped', () => console.log('%s stopped.', this.name));

        //API Server
        this.on('apiServerStarted', () => console.log('API server running on %s:%s%s', this.ip, this.apiPort, this.apiBaseUrl));
        this.on('apiServerStopped', () => console.log('Stopped API server.'));

        //STSCP Server
        this.on('stscpServerStarted', () => console.log('STSCP server running on %s:%s', this.ip, this.stscpPort));
        this.on('stscpServerStopped', () => console.log('Stopped STSCP Server.'));

        //STSCP Client Manager
        this.on('stscpClientManagerConnected', () => console.log('STSCP client manager connected.'));
        this.on('stscpClientManagerDisconnected', () => console.log('STSCP client manager disconnected.'));
        this.on('stscpClientConnected', (client: StscpClient) => console.log('Node connected to stscp://%s:%s', client.host, client.port));
        this.on('stscpClientDisconnected', (client: StscpClient) => console.log('Node disconnected from stscp://%s:%s', client.host, client.port));
        this.on('stscpClientReconnecting', (client: StscpClient) => console.log('Node reconnecting to stscp://%s:%s', client.host, client.port));

        //DB Manager
        this.on('dbConnected', () => console.log('DB client connected to %s://%s/%s', dbManager.type, dbManager.host, dbManager.name));
        this.on('dbDisconnected', () => console.log('DB Disconnected'));

        //Inject Files
        // this.on(Events.API_SERVER_ADDED_CONTROLLER, (name: string, controller: Controller) => console.log('Added controller: %s', name));
        // commServer.on(Events.COMM_SERVER_ADDED_PUBLISHER, (name: string, publisher: Publisher) => console.log('Added publisher: %s', name));
        // dbManager.on(Events.DB_ADDED_MODEL, (modelName: string, entityName: string, model: Model) => console.log('Added model: %s(%s)', modelName, entityName));
    }
}

/////////////////////////
///////Defaults
/////////////////////////
export type Options = {
    name?: string
    version?: string
}

//Types: AutoLoadOptions
export type AutoLoadOptions = {
    includes?: Array<string>,
    excludes?: Array<string>
}

/////////////////////////
///////Defaults
/////////////////////////
export class Defaults {
    public static readonly ENVIRONMENT: string = 'production';
    public static readonly API_PORT: number = 3000;
    public static readonly STSCP_PORT: number = 6000;
    public static readonly FORCE_STOP_TIME: number = 1000 * 5;
}

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