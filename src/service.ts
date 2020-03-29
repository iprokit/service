//Import @iprotechs Modules
import { Server as StscpServer, ClientManager as StscpClientManager, Client as StscpClient, Mesh as StscpMesh, MessageReplyHandler, Body, ActionBreak } from '@iprotechs/stscp';

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
import Default from './default';
import Helper, { FileOptions } from './helper';
import Publisher from './stscp.publisher';
import Controller from './api.controller';
import DBManager, { RDB, NoSQL, Type as DBType, Model, ModelAttributes, ConnectionOptionsError, ModelError } from './db.manager';

//////////////////////////////
//////Global Variables
//////////////////////////////
/**
 * The apiApp, i.e: `Express`.
 */
let apiApp: Express;

/**
 * The apiRouter, i.e: `ExpressRouter`.
 */
let apiRouter: Router;

/**
 * The apiServer, i.e: `HttpServer`.
 */
let apiServer: HttpServer;

/**
 * The dbManager, i.e: `DBManager`.
 */
let dbManager: DBManager;

/**
 * The stscpServer, i.e: `StscpServer`.
 */
let stscpServer: StscpServer;

/**
 * The stscpClientManager, i.e: `StscpClientManager`.
 */
let stscpClientManager: StscpClientManager;

/**
 * `Mesh` is a representation of unique server's in the form of Object's.
 *
 * During runtime:
 * `Node` objects are populated into `Mesh` with its name as a get accessor.
 * All the `Node` objects are exposed in this with its callable name,
 * which can be declared with `service.defineNode()`.
 */
export const Mesh: StscpMesh = StscpClientManager.mesh;

/**
 * This class is an implementation of a simple and lightweight service.
 * It can be used to implement a service/micro-service.
 * It can communicate with other `Service`'s using STSCP(service to service communication protocol).
 * The API Server is built on top of `Express` and its components.
 * Supports NoSQL(`Mongoose`)/RDB(`Sequelize`), i.e: `mongo`, `mysql`, `postgres`, `sqlite`, `mariadb` and `mssql` databases.
 * It auto wires and injects, generic `Model`'s, `Controller`'s and `Publisher`'s into the service from the project with decorators.
 * Creates default API Endpoints.
 * 
 * Default API Endpoints.
 * - /health - To validate if the service is healthy.
 * - /report - To get all the service reports.
 * - /shutdown - To shutdown the service safely.
 * 
 * @emits `starting` when the service is starting.
 * @emits `ready` when the service is ready to be used to make API calls.
 * @emits `stopping` when the service is in the process of stopping.
 * @emits `stopped` when the service is stopped.
 * @emits `apiServerListening` when the `apiServer` is listening.
 * @emits `apiServerStopped` when the `apiServer` is stopped.
 * @emits `stscpServerListening` when the `stscpServer` is listening.
 * @emits `stscpServerStopped` when the `stscpServer` is stopped.
 * @emits `stscpClientManagerConnected` when the `stscpClientManager` is connected.
 * @emits `stscpClientManagerDisconnected` when the `stscpClientManager` is disconnected.
 * @emits `stscpClientConnected` when the `stscpClient` is connected.
 * @emits `stscpClientDisconnected` when the `stscpClient` is disconnected.
 * @emits `stscpClientReconnecting` when the `stscpClient` is reconnecting.
 * @emits `dbManagerConnected` when the `dbManager` is connected.
 * @emits `dbManagerDisconnected` when the `dbManager` is disconnected.
 * @emits `autoWireModel` when a model is auto wired.
 * @emits `autoInjectPublisher` when a publisher actions are injected.
 * @emits `autoInjectController` when a controler endpoints are injected.
 */
export default class Service extends EventEmitter {
    /**
     * The name of the service, retrieved from `process.env.npm_package_name`.
     */
    public readonly name: string;

    /**
     * The version of the service, retrieved from `process.env.npm_package_version`.
     */
    public readonly version: string;

    /**
     * The environment of the service, retrieved from `process.env.NODE_ENV`.
     * 
     * @default `Defaults.ENVIRONMENT`
     */
    public readonly environment: string;

    /**
     * The ip of the service.
     */
    public readonly ip: string;

    /**
     * The base URL of the service.
     * 
     * @default `service.name`
     */
    public readonly apiBaseUrl: string;

    /**
     * The API Server port of the service, retrieved from `process.env.API_PORT`.
     * 
     * @default `Defaults.API_PORT`
     */
    public readonly apiPort: number;

    /**
     * The STSCP Server port of the service, retrieved from `process.env.STSCP_PORT`.
     * 
     * @default `Defaults.STSCP_PORT`
     */
    public readonly stscpPort: number;

    /**
     * The time to wait before the service is forcefully stopped when `service.stop()`is called.
     * 
     * @default `Defaults.FORCE_STOP_TIME`
     */
    public forceStopTime: number;

    /**
     * The autoinjected `Publisher`'s under this service.
     */
    private readonly _publishers: Array<Publisher>;

    /**
     * The autoinjected `Controller`'s under this service.
     */
    private readonly _controllers: Array<Controller>;

    /**
     * Auto wire `Model` options.
     * 
     * @default
     * { include: { endsWith: ['.model'] } }
     */
    private _autoWireModelOptions: FileOptions;

    /**
     * Auto inject `Publisher` options.
     * 
     * @default
     * { include: { endsWith: ['.publisher'] } }
     */
    private _autoInjectPublisherOptions: FileOptions;

    /**
     * Auto inject `Controller` options.
     * 
     * @default
     * { include: { endsWith: ['.controller'] } }
     */
    private _autoInjectControllerOptions: FileOptions;

    /**
     * Creates an instance of a `Service`.
     * 
     * @param baseUrl the optional, base/root url.
     * @param options the optional, `Service` options.
     */
    public constructor(baseUrl?: string, options?: Options) {
        //Call super for EventEmitter.
        super();

        //Set null defaults.
        options = options || {};

        //Initialize service variables.
        this.name = options.name || process.env.npm_package_name;
        this.version = options.version || process.env.npm_package_version;
        this.environment = process.env.NODE_ENV || Default.ENVIRONMENT;
        this.ip = Helper.getContainerIP();
        this.forceStopTime = Default.FORCE_STOP_TIME;

        //Initialize API server variables.
        this.apiBaseUrl = baseUrl || '/' + this.name.toLowerCase();
        this.apiPort = Number(process.env.API_PORT) || Default.API_PORT;

        //Initialize STSCP variables.
        this.stscpPort = Number(process.env.STSCP_PORT) || Default.STSCP_PORT;

        //Initialize Action's/API's
        this._publishers = new Array();
        this._controllers = new Array();

        //Initialize Autoload Variables.
        this._autoWireModelOptions = { include: { endsWith: ['.model'] } };
        this._autoInjectPublisherOptions = { include: { endsWith: ['.publisher'] } };
        this._autoInjectControllerOptions = { include: { endsWith: ['.controller'] } };

        //Initialize Components.
        this.initAPIServer();
        this.initSTSCP();
        this.initDBManager();

        this.addProcessListeners();
    }

    //////////////////////////////
    //////Init
    //////////////////////////////
    /**
     * Initialize API Server by setting up `Express` and `ExpressRouter`.
     * Adds default API Endpoints by calling `service.addDefaultAPIEndpoints()`.
     */
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

        this.addDefaultAPIEndpoints();
    }

    /**
     * Initialize STSCP by setting up `StscpServer` and `StscpClientManager`.
     */
    private initSTSCP() {
        stscpServer = new StscpServer(this.name);
        stscpClientManager = new StscpClientManager(this.name);

        //Bind Events for stscpClientManager
        stscpClientManager.on('clientConnected', (client: StscpClient) => this.emit('stscpClientConnected', client));
        stscpClientManager.on('clientDisconnected', (client: StscpClient) => this.emit('stscpClientDisconnected', client));
        stscpClientManager.on('clientReconnecting', (client: StscpClient) => this.emit('stscpClientReconnecting', client));
    }

    /**
     * Initialize `DBManager`.
     */
    private initDBManager() {
        //Setup DB Manager.
        dbManager = new DBManager();
    }

    //////////////////////////////
    //////Inject
    //////////////////////////////
    /**
     * Inject files into the module. Respecting the order of loading for dependency.
     * 
     * Order: Model, Publisher, Controller
     * 
     * After each `require()`, annotation will automatically be called.
     * Allowing it to be binded to its parent component, i.e: dbManager(Model), Service(Publisher, Controller).
     */
    private injectFiles() {
        /**
         * All the files in this project.
         */
        const files = Helper.findFilePaths(projectPath, { include: { extension: ['.js'] } });

        //Wiring Models.
        files.forEach(file => {
            if (Helper.filterFile(file, this._autoWireModelOptions)) {
                //Load.
                const _Model: Model = require(file).default;

                this.emit('autoWireModel', _Model.name);
            }
        });

        //Injecting Publishers.
        files.forEach(file => {
            if (Helper.filterFile(file, this._autoInjectPublisherOptions)) {
                //Load, Initialize, Push to array.
                const _Publisher = require(file).default;
                const publisher: Publisher = new _Publisher();
                this._publishers.push(publisher);


                this.emit('autoInjectPublisher', publisher.name);
            }
        });

        //Injecting Controllers.
        files.forEach(file => {
            if (Helper.filterFile(file, this._autoInjectControllerOptions)) {
                //Load, Initialize, Push to array.
                const _Controller = require(file).default;
                const controller: Controller = new _Controller();
                this._controllers.push(controller);

                this.emit('autoInjectController', controller.name);
            }
        });
    }

    //////////////////////////////
    //////DB
    //////////////////////////////
    /**
     * Initialize and use database.
     * 
     * Supports NoSQL/RDB types, i.e: `mongo`, `mysql`, `postgres`, `sqlite`, `mariadb` and `mssql` databases.
     * 
     * @param type the type of the database.
     * @param paperTrail set to true if the paper trail operation should be performed, false otherwise.
     */
    public useDB(type: DBType, paperTrail?: boolean) {
        try {
            //Initialize the database connection.
            dbManager.init(type, paperTrail);

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
                console.error(error.message);
            } else {
                console.error('dbManager', error);
            }
            console.log('Will continue...');
        }
    }

    //////////////////////////////
    //////Start/Stop
    //////////////////////////////
    /**
     * Starts the service.
     * 
     * @param callback optional callback, called when the service is started.
     */
    public start(callback?: () => void) {
        //Emit Global: starting.
        this.emit('starting');

        //Load files
        this.injectFiles();

        //Start API Server
        apiServer = apiApp.listen(this.apiPort, () => {
            //Emit Global: apiServerListening.
            this.emit('apiServerListening');

            //Start STSCP Server
            stscpServer.listen(this.stscpPort, () => {
                //Emit Global: stscpServerListening.
                this.emit('stscpServerListening');

                //Start STSCP Client Manager
                (stscpClientManager.clients.length > 0) && stscpClientManager.connect(() => {
                    //Emit Global: stscpClientManagerConnected.
                    this.emit('stscpClientManagerConnected');
                });

                //Start DB Manager
                (dbManager.connection) && dbManager.connect((error) => {
                    if (!error) {
                        //Emit Global: dbManagerConnected.
                        this.emit('dbManagerConnected');
                    } else {
                        if (error instanceof ConnectionOptionsError) {
                            console.error(error.message);
                        } else {
                            console.error('dbManager', error);
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

    /**
     * Stops the service.
     * If the service is not stopped in `service.forceStopTime` it will be forcefully stopped.
     * 
     * - exitCode is 0 on stop.
     * - exitCode is 1 on error.
     * 
     * @param callback optional callback, called when the service is stopped.
     */
    public stop(callback: (exitCode: number) => void) {
        //Emit Global: stopping.
        this.emit('stopping');

        setTimeout(() => {
            callback(1);
            console.error('Forcefully shutting down.');
        }, this.forceStopTime);

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
                (stscpClientManager.clients.length > 0) && stscpClientManager.disconnect(() => {
                    //Emit Global: stscpClientManagerDisconnected.
                    this.emit('stscpClientManagerDisconnected');
                });

                //Stop DB Manager
                (dbManager.connection) && dbManager.disconnect((error) => {
                    if (!error) {
                        //Emit Global: dbManagerDisconnected.
                        this.emit('dbManagerDisconnected');
                    }
                });

                //Emit Global: stopped.
                this.emit('stopped');

                //Callback.
                callback(0);
            });
        });
    }

    //////////////////////////////
    //////Wire/Inject
    //////////////////////////////
    /**
     * Set's the auto wire `Model` options.
     * 
     * @param options the options to set. Only `options.includes` or `options.excludes` is considered.
     * 
     * @default
     * { include: { endsWith: ['.model'] } }
     */
    public setAutoWireModelOptions(options?: FileOptions) {
        this._autoWireModelOptions = (options === undefined) ? this._autoWireModelOptions : options;
    }

    /**
     * Set's the auto inject `Publisher` options.
     * 
     * @param options the options to set. Only `options.includes` or `options.excludes` is considered.
     * 
     * @default
     * { include: { endsWith: ['.publisher'] } }
     */
    public setAutoInjectPublisherOptions(options?: FileOptions) {
        this._autoInjectPublisherOptions = (options === undefined) ? this._autoInjectPublisherOptions : options;
    }

    /**
     * Set's the auto inject `Controller` options.
     * 
     * @param options the options to set. Only `options.includes` or `options.excludes` is considered.
     * 
     * @default
     * { include: { endsWith: ['.controller'] } }
     */
    public setAutoInjectControllerOptions(options?: FileOptions) {
        this._autoInjectControllerOptions = (options === undefined) ? this._autoInjectControllerOptions : options;
    }

    //////////////////////////////
    //////API Server
    //////////////////////////////
    /**
     * Creates `all` middlewear handlers on the API `Router` that works on all HTTP/HTTPs verbose, i.e `get`, `post`, `put`, `delete`, etc...
     * 
     * @param path the endpoint path.
     * @param handlers the handlers to be called. The handlers will take request and response as parameters.
     */
    public all(path: PathParams, ...handlers: RequestHandler[]) {
        apiRouter.all(path, ...handlers);
    }

    /**
     * Creates `get` middlewear handlers on the API `Router` that works on `get` HTTP/HTTPs verbose.
     * 
     * @param path the endpoint path.
     * @param handlers the handlers to be called. The handlers will take request and response as parameters.
     */
    public get(path: PathParams, ...handlers: RequestHandler[]) {
        apiRouter.get(path, ...handlers);
    }

    /**
     * Creates `post` middlewear handlers on the API `Router` that works on `post` HTTP/HTTPs verbose.
     * 
     * @param path the endpoint path.
     * @param handlers the handlers to be called. The handlers will take request and response as parameters.
     */
    public post(path: PathParams, ...handlers: RequestHandler[]) {
        apiRouter.post(path, ...handlers);
    }

    /**
     * Creates `put` middlewear handlers on the API `Router` that works on `put` HTTP/HTTPs verbose.
     * 
     * @param path the endpoint path.
     * @param handlers the handlers to be called. The handlers will take request and response as parameters.
     */
    public put(path: PathParams, ...handlers: RequestHandler[]) {
        apiRouter.put(path, ...handlers);
    }

    /**
     * Creates `delete` middlewear handlers on the API `Router` that works on `delete` HTTP/HTTPs verbose.
     * 
     * @param path the endpoint path.
     * @param handlers the handlers to be called. The handlers will take request and response as parameters.
     */
    public delete(path: PathParams, ...handlers: RequestHandler[]) {
        apiRouter.delete(path, ...handlers);
    }

    //////////////////////////////
    //////STSCP Server
    //////////////////////////////
    /**
     * Creates a `reply` handler on the `StscpServer`.
     * 
     * @param action the unique action.
     * @param handler the handler to be called. The handler will take message and reply as parameters.
     */
    public reply(action: string, handler: MessageReplyHandler) {
        stscpServer.reply(action, handler);
    }

    /**
     * Defines a STSCP broadcast action on the `StscpServer`.
     * 
     * @param action the action.
     */
    public defineBroadcast(action: string) {
        stscpServer.defineBroadcast(action);
    }

    /**
     * Triggers the broadcast action on the `StscpServer` and transmits the body to all the clients connected to this `StscpServer`.
     * A broadcast has to be defined `service.defineBroadcast()` before broadcast action can be transmitted.
     * 
     * @param action the action.
     * @param body the body to send.
     */
    public broadcast(action: string, body: Body) {
        stscpServer.broadcast(action, body);
    }

    //////////////////////////////
    //////STSCP Server - Static
    //////////////////////////////
    /**
     * Triggers the broadcast action on the `StscpServer` and transmits the body to all the clients connected to this `StscpServer`.
     * A broadcast has to be defined `service.defineBroadcast()` before broadcast action can be transmitted.
     * 
     * @param action the action.
     * @param body the body to send.
     * 
     * @static
     */
    public static broadcast(action: string, body: Body) {
        stscpServer.broadcast(action, body);
    }

    //////////////////////////////
    //////STSCP Client Manager
    //////////////////////////////
    /**
     * Creates a new `StscpClient` and `Node` on `StscpClientManager`.
     * 
     * Retrieve the Node by importing `Mesh` from the package.
     *
     * @param url The remote server address.
     * @param nodeName The callable name of the node.
     */
    public defineNode(url: string, nodeName: string) {
        stscpClientManager.createClient(url, nodeName);
    }

    //////////////////////////////
    //////DB Manager
    //////////////////////////////
    /**
     * The RDB `Connection` object.
     */
    public get rdbConnection(): RDB {
        return dbManager.connection as RDB;
    }

    /**
     * The NoSQL `Connection` object.
     */
    public get noSQLConnection(): NoSQL {
        return dbManager.connection as NoSQL;
    }

    //////////////////////////////
    //////DB Manager - Static
    //////////////////////////////
    /**
     * The RDB `Connection` object.
     * 
     * @static
     */
    public static get rdbConnection(): RDB {
        return dbManager.connection as RDB;
    }

    /**
     * The NoSQL `Connection` object.
     * 
     * @static
     */
    public static get noSQLConnection(): NoSQL {
        return dbManager.connection as NoSQL;
    }

    //////////////////////////////
    //////Model's, Action's, API's
    //////////////////////////////
    /**
     * The autowired `Model`'s under the database `Connection` object.
     */
    public get models() {
        return dbManager.models;
    }

    /**
     * The autoinjected `Publisher`'s under this service.
     */
    public get publishers() {
        return this._publishers;
    }

    /**
     * The autoinjected `Controller`'s under this service.
     */
    public get controllers() {
        return this._controllers;
    }

    //////////////////////////////
    //////Default API & Reports
    //////////////////////////////
    /**
     * Adds the default(`/health`, `/report`, `/shutdown`) API Endpoints.
     */
    private addDefaultAPIEndpoints() {
        //Default Service Routes
        apiRouter.get('/health', (request, response) => {
            const health = {
                name: this.name,
                version: this.version,
                environment: this.environment,
                api: apiServer.listening,
                stscp: stscpServer.listening,
                mesh: stscpClientManager.connected,
                db: dbManager.connected,
                healthy: (apiServer.listening && stscpServer.listening)
            }
            response.status(HttpCodes.OK).send(health);
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
                    system: this.getSystemReport(),
                    db: dbManager.connection && this.getDBReport(),
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

    /**
     * @returns the CPU and Memory report.
     */
    private getSystemReport() {
        let memoryUsage: { [key: string]: string } = {};

        Object.entries(process.memoryUsage()).forEach(([key, value]) => {
            memoryUsage[key] = Math.round(value / 1024 / 1024 * 100) / 100 + 'MB';
        });

        const cpuUsage = process.cpuUsage();

        return {
            pid: process.pid,
            cpu: {
                system: cpuUsage.system,
                user: cpuUsage.user
            },
            memory: memoryUsage
        }
    }

    /**
     * @returns the `DBManager` report.
     */
    private getDBReport() {
        let models: { [name: string]: string } = {};

        //Gets models.
        if (dbManager.noSQL) {
            (dbManager.models).forEach(model => {
                models[model.name] = model.collection.name;
            });
        } else {
            dbManager.models.forEach(model => {
                models[model.name] = model.tableName;
            });
        }

        return {
            name: dbManager.name,
            host: dbManager.host,
            type: dbManager.type,
            connected: dbManager.connected,
            models: models
        }
    }

    /**
     * @returns the API `Router` report.
     */
    private apiRouteReport() {
        const apiRoutes: { [controller: string]: Array<{ fn: string, [method: string]: string }> } = {};

        //Get API Routes.
        apiRouter.stack.forEach(item => {
            const _stack = item.route.stack[0];

            //Create Variables.
            const path = String(item.route.path);
            const controllerName = path.split('/').filter(Boolean)[0];
            const functionName = (_stack.handle.name === '') ? '<anonymous>' : String(_stack.handle.name);
            const method = (_stack.method === undefined) ? 'all' : String(_stack.method).toUpperCase();

            //Try creating empty object.
            if (!apiRoutes[controllerName]) {
                apiRoutes[controllerName] = [];
            }

            //Add to object.
            apiRoutes[controllerName].push({ fn: functionName, [method]: this.apiBaseUrl + path });
        });

        return apiRoutes;
    }

    /**
     * @returns the STSCP `Router` report.
     */
    private stscpRouteReport() {
        const stscpRoutes: { [publisher: string]: string } = {};

        //Get STSCP Routes.
        stscpServer.routes.forEach(item => {
            //Create Variables.
            const map = String(item.map);
            const type = String(item.type).toUpperCase();

            //Add to object.
            stscpRoutes[map] = type;
        });

        return stscpRoutes;
    }

    /**
     * @returns the STSCP `Mesh` report.
     */
    private stscpMeshReport() {
        const mesh = new Array();

        //Get STSCP Clients.
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

    //////////////////////////////
    //////Listeners
    //////////////////////////////
    /**
     * Adds process listeners on `SIGTERM` and `SIGINT`.
     */
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

    /**
     * Adds listeners to call `console.log()`.
     */
    public addListeners() {
        //Service
        this.on('starting', () => console.log('Starting %s: %o', this.name, { version: this.version, environment: this.environment }));
        this.on('ready', () => console.log('%s ready.', this.name));
        this.on('stopping', () => console.log('Stopping %s...', this.name));
        this.on('stopped', () => console.log('%s stopped.', this.name));

        //API Server
        this.on('apiServerListening', () => console.log('API server running on %s:%s%s', this.ip, this.apiPort, this.apiBaseUrl));
        this.on('apiServerStopped', () => console.log('Stopped API server.'));

        //STSCP Server
        this.on('stscpServerListening', () => console.log('STSCP server running on %s:%s', this.ip, this.stscpPort));
        this.on('stscpServerStopped', () => console.log('Stopped STSCP Server.'));
        stscpServer.on('error', (error: any) => {
            console.error('stscpServer', error);
            console.log('Will continue...');
        });

        //STSCP Client Manager
        this.on('stscpClientManagerConnected', () => console.log('STSCP client manager connected.'));
        this.on('stscpClientManagerDisconnected', () => console.log('STSCP client manager disconnected.'));
        this.on('stscpClientConnected', (client: StscpClient) => {
            console.log('Node connected to stscp://%s:%s', client.host, client.port);

            client.on('error', (error: any) => {
                console.error('stscpClientManager', error);
                console.log('Will continue...');
            });

        });
        this.on('stscpClientDisconnected', (client: StscpClient) => console.log('Node disconnected from stscp://%s:%s', client.host, client.port));
        // this.on('stscpClientReconnecting', (client: StscpClient) => console.log('Node reconnecting to stscp://%s:%s', client.host, client.port));

        //DB Manager
        this.on('dbManagerConnected', () => console.log('DB client connected to %s://%s/%s', dbManager.type, dbManager.host, dbManager.name));
        this.on('dbManagerDisconnected', () => console.log('DB Disconnected'));

        //Autoload Variables
        // this.on('autoWireModel', (name) => console.log('Wiring model: %s', name));
        // this.on('autoInjectPublisher', (name) => console.log('Adding actions from publisher: %s', name));
        // this.on('autoInjectController', (name) => console.log('Adding endpoints from controller: %s', name));
    }
}

//////////////////////////////
//////Type Definitions
//////////////////////////////
/**
 * Interface for the initialization options of `Service`.
 */
export interface Options {
    /**
     * The name of the service.
     */
    name?: string;

    /**
     * The version of the service.
     */
    version?: string;
}

//////////////////////////////
//////API Server Decorators
//////////////////////////////
/**
 * Interface for `RequestResponseFunction` descriptor.
 */
export interface RequestResponseFunctionDescriptor extends PropertyDescriptor {
    value: RequestHandler;
}

/**
 * Interface for `apiServer` decorators.
 */
export interface RequestResponseFunction {
    (target: typeof Controller, propertyKey: string, descriptor: RequestResponseFunctionDescriptor): void
};

/**
 * Creates `get` middlewear handler on the API `Router` that works on `get` HTTP/HTTPs verbose.
 * 
 * @param path the endpoint path.
 * @param rootPath set to true if the path is root path, false by default.
 */
export function Get(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (target, propertyKey, descriptor) => {
        const controllerName = target.name.replace('Controller', '').toLowerCase();

        if (!rootPath) {
            path = ('/' + controllerName + path);
        }

        apiRouter.get(path, descriptor.value);
    }
}

/**
 * Creates `post` middlewear handler on the API `Router` that works on `post` HTTP/HTTPs verbose.
 * 
 * @param path the endpoint path.
 * @param rootPath set to true if the path is root path, false by default.
 */
export function Post(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (target, propertyKey, descriptor) => {
        const controllerName = target.name.replace('Controller', '').toLowerCase();

        if (!rootPath) {
            path = ('/' + controllerName + path);
        }

        apiRouter.post(path, descriptor.value);
    }
}

/**
 * Creates `put` middlewear handler on the API `Router` that works on `put` HTTP/HTTPs verbose.
 * 
 * @param path the endpoint path.
 * @param rootPath set to true if the path is root path, false by default.
 */
export function Put(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (target, propertyKey, descriptor) => {
        const controllerName = target.name.replace('Controller', '').toLowerCase();

        if (!rootPath) {
            path = ('/' + controllerName + path);
        }

        apiRouter.put(path, descriptor.value);
    }
}

/**
 * Creates `delete` middlewear handler on the API `Router` that works on `delete` HTTP/HTTPs verbose.
 * 
 * @param path the endpoint path.
 * @param rootPath set to true if the path is root path, false by default.
 */
export function Delete(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (target, propertyKey, descriptor) => {
        const controllerName = target.name.replace('Controller', '').toLowerCase();

        if (!rootPath) {
            path = ('/' + controllerName + path);
        }

        apiRouter.delete(path, descriptor.value);
    }
}

//////////////////////////////
//////STSCP Server Decorators
//////////////////////////////
/**
 * Interface for `MessageReplyFunction` descriptor.
 */
interface MessageReplyDescriptor extends PropertyDescriptor {
    value: MessageReplyHandler;
}

/**
 * Interface for `StscpServer` decorators.
 */
export interface MessageReplyFunction {
    (target: typeof Publisher, propertyKey: string, descriptor: MessageReplyDescriptor): void;
}

/**
 * Creates a `reply` handler on the `StscpServer`.
 */
export function Reply(): MessageReplyFunction {
    return (target, propertyKey, descriptor) => {
        const publisherName = target.name.replace('Publisher', '');

        const action = publisherName + ActionBreak.MAP + propertyKey;
        stscpServer.reply(action, descriptor.value);
    }
}

//////////////////////////////
//////DB Decorators
//////////////////////////////
/**
 * Interface for `DBManager` decorators.
 */
export interface ModelClass {
    (target: Model): void;
}

/**
 * Interface for Entity options.
 */
export interface EntityOptions {
    /**
     * @param name the entity name of the model, i.e : collectionName/tableName.
     */
    name: string;

    /**
     * @param attributes the entity attributes.
     */
    attributes: ModelAttributes;
}

/**
 * Initialize the `Model` instance.
 * 
 * @param entityOptions the entity options.
 */
export function Entity(entityOptions: EntityOptions): ModelClass {
    return (target) => {
        if (dbManager.connection) {
            const modelName = target.name.replace('Model', '');

            //Validate if the database type and model type match.
            try {
                dbManager.initModel(modelName, entityOptions.name, entityOptions.attributes, target);
            } catch (error) {
                if (error instanceof ModelError) {
                    console.error(error.message);
                } else {
                    console.error('model', error);
                }
                console.log('Will continue...');
            }
        }
    }
}