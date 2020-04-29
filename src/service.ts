//Import @iprotechs Modules
import scp, { Server as ScpServer, ClientManager as ScpClientManager, NodeClient, Mesh as ScpMesh, MessageReplyHandler, Body, Action, StatusType, Logging } from '@iprotechs/scp';

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
import winston, { Logger } from 'winston';
import morgan from 'morgan';
import WinstonDailyRotateFile from 'winston-daily-rotate-file';
import { URL } from 'url';

//Load Environment variables from .env file.
const projectPath = path.dirname(require.main.filename);
const envPath = path.join(projectPath, '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

//Local Imports
import Default from './default';
import Helper, { FileOptions } from './helper';
import Messenger from './messenger';
import Controller from './controller';
import DBManager, { RDB, NoSQL, Type as DBType, Model, ModelAttributes, ConnectionOptionsError, ModelError } from './db.manager';

//////////////////////////////
//////Global Variables
//////////////////////////////
/**
 * `Mesh` is a representation of unique server's in the form of Object's.
 *
 * During runtime:
 * `Node` objects are populated into `Mesh` with its name as a get accessor.
 * All the `Node` objects are exposed in this with its node name,
 * which can be declared with `service.defineNode()`.
 */
export const Mesh: ScpMesh = new ScpMesh();
//TODO: Move this to micro.

/**
 * This class is an implementation of a simple and lightweight service.
 * It can be used to implement a service/micro-service.
 * It can communicate with other `Service`'s using SCP(service communication protocol).
 * The API Server is built on top of `Express` and its components.
 * Supports NoSQL(`Mongoose`)/RDB(`Sequelize`), i.e: `mongo`, `mysql`, `postgres`, `sqlite`, `mariadb` and `mssql` databases.
 * It auto wires and injects, generic `Model`'s, `Controller`'s and `Messenger`'s into the service from the project with decorators.
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
 * @emits `scpServerListening` when the `scpServer` is listening.
 * @emits `scpServerStopped` when the `scpServer` is stopped.
 * @emits `scpClientManagerConnected` when the `scpClientManager` is connected.
 * @emits `scpClientManagerDisconnected` when the `scpClientManager` is disconnected.
 * @emits `scpClientConnected` when the `scpClient` is connected.
 * @emits `scpClientDisconnected` when the `scpClient` is disconnected.
 * @emits `scpClientReconnecting` when the `scpClient` is reconnecting.
 * @emits `dbManagerConnected` when the `dbManager` is connected.
 * @emits `dbManagerDisconnected` when the `dbManager` is disconnected.
 * @emits `autoWireModel` when a model is auto wired.
 * @emits `autoInjectMessenger` when a messenger actions are injected.
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
     * @default `Default.ENVIRONMENT`
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
     * @default `Default.API_PORT`
     */
    public readonly apiPort: number;

    /**
     * The SCP Server port of the service, retrieved from `process.env.SCP_PORT`.
     * 
     * @default `Default.SCP_PORT`
     */
    public readonly scpPort: number;

    /**
     * The time to wait before the service is forcefully stopped when `service.stop()`is called.
     * 
     * @default `Default.FORCE_STOP_TIME`
     */
    public readonly forceStopTime: number;

    /**
     * The path to log files of the service, retrieved from `process.env.LOG_PATH`.
     * 
     * @default `Default.LOG_PATH`
     */
    public readonly logPath: string;

    /**
     * The autoinjected `Messenger`'s under this service.
     */
    public readonly messengers: Array<Messenger>;

    /**
     * The autoinjected `Controller`'s under this service.
     */
    public readonly controllers: Array<Controller>;

    /**
     * Auto wire `Model` options.
     * 
     * @default
     * { include: { endsWith: ['.model'] } }
     */
    private _autoWireModelOptions: FileOptions;

    /**
     * Auto inject `Messenger` options.
     * 
     * @default
     * { include: { endsWith: ['.messenger'] } }
     */
    private _autoInjectMessengerOptions: FileOptions;

    /**
     * Auto inject `Controller` options.
     * 
     * @default
     * { include: { endsWith: ['.controller'] } }
     */
    private _autoInjectControllerOptions: FileOptions;

    /**
     * Instance of `Express` application.
     */
    public readonly express: Express;

    /**
     * Instance of `ExpressRouter`.
     */
    public readonly expressRouter: Router;

    /**
     * Instance of `HttpServer`.
     */
    private _apiServer: HttpServer;

    /**
     * Instance of `ScpServer`.
     */
    public readonly scpServer: ScpServer;

    /**
     * Instance of `ScpClientManager`.
     */
    public readonly scpClientManager: ScpClientManager;

    /**
     * Instance of `DBManager`.
     */
    public readonly dbManager: DBManager;

    /**
     * The logger instance.
     */
    public readonly logger: Logger;

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
        this.forceStopTime = options.forceStopTime || Default.FORCE_STOP_TIME;
        this.environment = process.env.NODE_ENV || Default.ENVIRONMENT;
        this.ip = Helper.getContainerIP();

        //Initialize API server variables.
        this.apiBaseUrl = baseUrl || '/' + this.name.toLowerCase();
        this.apiPort = Number(process.env.API_PORT) || Default.API_PORT;

        //Initialize SCP variables.
        this.scpPort = Number(process.env.SCP_PORT) || Default.SCP_PORT;

        //Initialize Logger variables.
        this.logPath = process.env.LOG_PATH || path.join(projectPath, Default.LOG_PATH);

        //Initialize Action's/API's
        this.messengers = new Array();
        this.controllers = new Array();

        //Initialize Autoload Variables.
        this._autoWireModelOptions = { include: { endsWith: ['.model'] } };
        this._autoInjectMessengerOptions = { include: { endsWith: ['.messenger'] } };
        this._autoInjectControllerOptions = { include: { endsWith: ['.controller'] } };

        //Initialize Logger.
        this.logger = winston.createLogger();
        this.initLogger();

        //Initialize Express.
        this.express = express();
        this.expressRouter = express.Router();
        this.configExpress();

        //Initialize SCP
        const scpLogger = this.logger.child({ component: 'SCP' });
        const scpLoggerWrite: Logging = {
            action: (id, remoteAddress, verbose, action, status, ms) => {
                scpLogger.info(`${id}(${remoteAddress}) ${verbose} ${action.map} ${StatusType.getMessage(status)}(${status}) - ${ms} ms`);
            }
        }

        const meshLogger = this.logger.child({ component: 'Mesh' });
        const meshLoggerWrite: Logging = {
            action: (id, remoteAddress, verbose, action, status, ms) => {
                meshLogger.info(`${id}(${remoteAddress}) ${verbose} ${action.map} ${StatusType.getMessage(status)}(${status}) - ${ms} ms`);
            }
        }

        this.scpServer = scp.createServer({ name: this.name, logging: scpLoggerWrite });
        this.scpClientManager = scp.createClientManager({ name: this.name, mesh: Mesh, logging: meshLoggerWrite })
        this.configSCP();

        //Initialize DB Manager
        const dbLogger = this.logger.child({ component: 'DB' });
        this.dbManager = new DBManager(dbLogger);

        //Bind Process Events.
        this.bindProcessEvents();
    }

    //////////////////////////////
    //////Init
    //////////////////////////////
    /**
     * Initialize logger by setting up winston.
     */
    private initLogger() {
        //Define _logger format.
        const format = winston.format.combine(
            winston.format.label(),
            winston.format.timestamp(),
            winston.format.printf((info) => {
                //Set info variables
                const component = info.component ? `${info.component}` : '-';

                //Return the log to stream.
                return `${info.timestamp} | ${info.level.toUpperCase()} | ${component} | ${info.message}`;
            })
        )

        //Add console transport.
        this.logger.add(new winston.transports.Console({
            level: 'debug',
            format: format
        }));

        //Try, Add file transport.
        if (this.environment !== 'development') {
            //Try creating path if it does not exist.
            if (!fs.existsSync(this.logPath)) {
                fs.mkdirSync(this.logPath);
            }

            //Add file transport.
            this.logger.add(new WinstonDailyRotateFile({
                level: 'info',
                format: format,
                filename: `${this.name}-%DATE%.log`,
                datePattern: 'DD-MM-YY-HH',
                dirname: this.logPath
            }));
        }
    }

    /**
     * Configures API Server by setting up `Express` and `ExpressRouter`.
     * Adds default API Endpoints by calling `service.addDefaultAPIEndpoints()`.
     */
    private configExpress() {
        //Setup Express
        this.express.use(cors());
        this.express.options('*', cors());
        this.express.use(express.json());
        this.express.use(express.urlencoded({ extended: false }));

        //Setup child logger for API.
        const apiLogger = this.logger.child({ component: 'API' });

        //Setup Morgan and bind it with Winston.
        this.express.use(morgan('(:remote-addr) :method :url :status - :response-time ms', {
            stream: {
                write: (log: string) => {
                    apiLogger.info(`${log.trim()}`);
                }
            }
        }));

        //Setup proxy pass.
        this.express.use((request: Request, response: Response, next: NextFunction) => {
            //Generate Proxy object from headers.
            Helper.generateProxyObjects(request);
            next();
        });

        //Setup Router
        this.express.use(this.apiBaseUrl, this.expressRouter);

        // Error handler for 404
        this.express.use((request: Request, response: Response, next: NextFunction) => {
            next(createError(404));
        });

        // Default error handler
        this.express.use((error: Error, request: Request, response: Response, next: NextFunction) => {
            response.locals.message = error.message;
            response.locals.error = this.environment === 'development' ? error : {};
            response.status((error as any).status || 500).send(error.message);
        });

        this.addDefaultAPIEndpoints();
    }

    /**
     * Configures SCP by setting up `ScpServer` and `ScpClientManager`.
     */
    private configSCP() {
        //Setup SCP server and bind events.
        this.scpServer.on('error', (error: Error) => {
            this.logger.error(error.stack);
        });

        //Setup SCP client manager and bind events.
        this.scpClientManager.on('clientConnected', (client: NodeClient) => {
            //Log Event.
            this.logger.info(`Node connected to ${client.url}`);

            this.emit('scpClientConnected', client);
        });
        this.scpClientManager.on('clientDisconnected', (client: NodeClient) => {
            //Log Event.
            this.logger.info(`Node disconnected from ${client.url}`);

            this.emit('scpClientDisconnected', client);
        });
        this.scpClientManager.on('clientReconnecting', (client: NodeClient) => {
            //Log Event.
            this.logger.silly(`Node reconnecting to ${client.url}`);

            this.emit('scpClientReconnecting', client);
        });
    }

    //////////////////////////////
    //////Inject
    //////////////////////////////
    /**
     * Inject files into the module. Respecting the order of loading for dependency.
     * 
     * Order: Model, Messenger, Controller
     * 
     * After each `require()`, annotation will automatically be called.
     * Allowing it to be binded to its parent component, i.e: dbManager(Model), Service(Messenger, Controller).
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

                //Log Event.
                this.logger.debug(`Wiring model: ${_Model.name}`);

                this.emit('autoWireModel', _Model.name);
            }
        });

        //Injecting Messengers.
        files.forEach(file => {
            if (Helper.filterFile(file, this._autoInjectMessengerOptions)) {
                //Load, Initialize, Push to array.
                const _Messenger = require(file).default;
                const messenger: Messenger = new _Messenger();
                this.messengers.push(messenger);

                //Log Event.
                this.logger.debug(`Adding actions from messenger: ${messenger.name}`);

                this.emit('autoInjectMessenger', messenger.name);
            }
        });

        //Injecting Controllers.
        files.forEach(file => {
            if (Helper.filterFile(file, this._autoInjectControllerOptions)) {
                //Load, Initialize, Push to array.
                const _Controller = require(file).default;
                const controller: Controller = new _Controller();
                this.controllers.push(controller);

                //Log Event.
                this.logger.debug(`Adding endpoints from controller: ${controller.name}`);

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
            this.dbManager.init(type, paperTrail);

            //DB routes.
            this.expressRouter.post('/db/sync', async (request, response) => {
                try {
                    const sync = await this.dbManager.sync(request.body.force);
                    response.status(HttpCodes.OK).send({ sync: sync, message: 'Database & tables synced!' });
                } catch (error) {
                    response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
                }
            });
        } catch (error) {
            if (error instanceof ConnectionOptionsError) {
                this.logger.error(error.message);
            } else {
                this.logger.error(error.stack);
            }
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
        //Log Event.
        this.logger.info(`Starting ${this.name} v.${this.version} in ${this.environment} environment.`);

        //Emit Global: starting.
        this.emit('starting');

        //Load files
        this.injectFiles();

        //TODO: Work on sequence PMICRO-88

        //Start API Server
        this._apiServer = this.express.listen(this.apiPort, () => {
            //Log Event.
            this.logger.info(`API server running on ${this.ip}:${this.apiPort}${this.apiBaseUrl}`);

            //Emit Global: apiServerListening.
            this.emit('apiServerListening');

            //Start SCP Server
            this.scpServer.listen(this.scpPort, () => {
                //Log Event.
                this.logger.info(`SCP server running on ${this.ip}:${this.scpPort}`);

                //Emit Global: scpServerListening.
                this.emit('scpServerListening');

                //Start SCP Client Manager
                (this.scpClientManager.clients.length > 0) && this.scpClientManager.connect(() => {
                    //Log Event.
                    this.logger.info(`SCP client manager connected.`);

                    //Emit Global: scpClientManagerConnected.
                    this.emit('scpClientManagerConnected');
                });

                //Start DB Manager
                (this.dbManager.connection) && this.dbManager.connect((error) => {
                    if (!error) {
                        //Log Event.
                        this.logger.info(`DB client connected to ${this.dbManager.type}://${this.dbManager.host}/${this.dbManager.name}`);

                        //Emit Global: dbManagerConnected.
                        this.emit('dbManagerConnected');
                    } else {
                        if (error instanceof ConnectionOptionsError) {
                            this.logger.error(error.message);
                        } else {
                            this.logger.error(error.stack);
                        }
                    }
                });

                //Log Event.
                this.logger.info(`${this.name} ready.`);

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
        //Log Event.
        this.logger.info(`Stopping ${this.name}...`);

        //Emit Global: stopping.
        this.emit('stopping');

        setTimeout(() => {
            callback(1);
            this.logger.error('Forcefully shutting down.');
        }, this.forceStopTime);

        //Stop API Servers
        this._apiServer.close((error) => {
            if (!error) {
                //Log Event.
                this.logger.info(`Stopped API server.`);

                //Emit Global: apiServerStopped.
                this.emit('apiServerStopped');
            }

            //Stop SCP Servers
            this.scpServer.close((error) => {
                if (!error) {
                    //Log Event.
                    this.logger.info(`Stopped SCP Server.`);

                    //Emit Global: scpServerStopped.
                    this.emit('scpServerStopped');
                }

                //Stop SCP Client Manager
                (this.scpClientManager.clients.length > 0) && this.scpClientManager.disconnect(() => {
                    //Log Event.
                    this.logger.info(`SCP client manager disconnected.`);

                    //Emit Global: scpClientManagerDisconnected.
                    this.emit('scpClientManagerDisconnected');
                });

                //Stop DB Manager
                (this.dbManager.connection) && this.dbManager.disconnect((error) => {
                    if (!error) {
                        //Log Event.
                        this.logger.info(`DB Disconnected.`);

                        //Emit Global: dbManagerDisconnected.
                        this.emit('dbManagerDisconnected');
                    }
                });

                //Log Event.
                this.logger.info(`${this.name} stopped.`);

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
     * Set's the auto inject `Messenger` options.
     * 
     * @param options the options to set. Only `options.includes` or `options.excludes` is considered.
     * 
     * @default
     * { include: { endsWith: ['.messenger'] } }
     */
    public setAutoInjectMessengerOptions(options?: FileOptions) {
        this._autoInjectMessengerOptions = (options === undefined) ? this._autoInjectMessengerOptions : options;
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
        this.expressRouter.all(path, ...handlers);
    }

    /**
     * Creates `get` middlewear handlers on the API `Router` that works on `get` HTTP/HTTPs verbose.
     * 
     * @param path the endpoint path.
     * @param handlers the handlers to be called. The handlers will take request and response as parameters.
     */
    public get(path: PathParams, ...handlers: RequestHandler[]) {
        this.expressRouter.get(path, ...handlers);
    }

    /**
     * Creates `post` middlewear handlers on the API `Router` that works on `post` HTTP/HTTPs verbose.
     * 
     * @param path the endpoint path.
     * @param handlers the handlers to be called. The handlers will take request and response as parameters.
     */
    public post(path: PathParams, ...handlers: RequestHandler[]) {
        this.expressRouter.post(path, ...handlers);
    }

    /**
     * Creates `put` middlewear handlers on the API `Router` that works on `put` HTTP/HTTPs verbose.
     * 
     * @param path the endpoint path.
     * @param handlers the handlers to be called. The handlers will take request and response as parameters.
     */
    public put(path: PathParams, ...handlers: RequestHandler[]) {
        this.expressRouter.put(path, ...handlers);
    }

    /**
     * Creates `delete` middlewear handlers on the API `Router` that works on `delete` HTTP/HTTPs verbose.
     * 
     * @param path the endpoint path.
     * @param handlers the handlers to be called. The handlers will take request and response as parameters.
     */
    public delete(path: PathParams, ...handlers: RequestHandler[]) {
        this.expressRouter.delete(path, ...handlers);
    }

    //////////////////////////////
    //////SCP Server
    //////////////////////////////
    /**
     * Creates a `reply` handler on the `ScpServer`.
     * 
     * @param action the unique action.
     * @param handler the handler to be called. The handler will take message and reply as parameters.
     */
    public reply(action: string, handler: MessageReplyHandler) {
        this.scpServer.reply(action, handler);
    }

    /**
     * Defines a SCP broadcast action on the `ScpServer`.
     * 
     * @param action the action.
     */
    public defineBroadcast(action: string) {
        this.scpServer.defineBroadcast(action);
    }

    /**
     * Triggers the broadcast action on the `ScpServer` and transmits the body to all the clients connected to this `ScpServer`.
     * A broadcast has to be defined `service.defineBroadcast()` before broadcast action can be transmitted.
     * 
     * @param action the action.
     * @param body the body to send.
     */
    public broadcast(action: string, body: Body) {
        this.scpServer.broadcast(action, body);
    }

    //////////////////////////////
    //////SCP Client Manager
    //////////////////////////////
    /**
     * Creates a new `ScpClient` and `Node` on `ScpClientManager`.
     * 
     * Retrieve the Node by importing `Mesh` from the package.
     *
     * @param url The remote server address.
     * @param nodeName The callable name of the node.
     */
    public defineNode(url: string, nodeName: string) {
        const _url = new URL(`scp://${url}`);
        _url.port = _url.port || Default.SCP_PORT.toString();

        const client = this.scpClientManager.createClient(nodeName, _url.toString());
        client.on('error', (error: Error) => {
            this.logger.error(error.stack);
        });
    }

    //////////////////////////////
    //////DB Manager
    //////////////////////////////
    /**
     * The RDB `Connection` object.
     */
    public get rdbConnection(): RDB {
        return this.dbManager.connection as RDB;
    }

    /**
     * The NoSQL `Connection` object.
     */
    public get noSQLConnection(): NoSQL {
        return this.dbManager.connection as NoSQL;
    }

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    /**
     * The autowired `Model`'s under the database `Connection` object.
     */
    public get models() {
        return this.dbManager.models;
    }

    //////////////////////////////
    //////Default API & Reports
    //////////////////////////////
    /**
     * Adds the default(`/health`, `/report`, `/shutdown`) API Endpoints.
     */
    private addDefaultAPIEndpoints() {
        //Default Service Routes
        this.expressRouter.get('/health', (request, response) => {
            const health = {
                name: this.name,
                version: this.version,
                environment: this.environment,
                api: this._apiServer.listening,
                scp: this.scpServer.listening,
                mesh: this.scpClientManager.connected,
                db: this.dbManager.connected,
                healthy: (this._apiServer.listening && this.scpServer.listening)
            }
            response.status(HttpCodes.OK).send(health);
        });

        this.expressRouter.get('/report', (request, response) => {
            try {
                const report = {
                    service: {
                        name: this.name,
                        version: this.version,
                        ip: this.ip,
                        apiPort: this.apiPort,
                        scpPort: this.scpPort,
                        environment: this.environment,
                        logPath: this.logPath
                    },
                    system: this.getSystemReport(),
                    db: this.dbManager.connection && this.getDBReport(),
                    api: this.apiRouteReport(),
                    scp: this.scpRouteReport(),
                    mesh: this.scpMeshReport()
                }

                response.status(HttpCodes.OK).send(report);
            } catch (error) {
                response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
            }
        });

        this.expressRouter.post('/shutdown', (request, response) => {
            response.status(HttpCodes.OK).send({ status: true, message: "Will shutdown in 2 seconds..." });
            setTimeout(() => {
                this.logger.info(`Received shutdown from ${request.url}`);
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
        if (this.dbManager.noSQL) {
            (this.dbManager.models).forEach(model => {
                models[model.name] = model.collection.name;
            });
        } else {
            this.dbManager.models.forEach(model => {
                models[model.name] = model.tableName;
            });
        }

        return {
            name: this.dbManager.name,
            host: this.dbManager.host,
            type: this.dbManager.type,
            connected: this.dbManager.connected,
            models: models
        }
    }

    /**
     * @returns the API `Router` report.
     */
    private apiRouteReport() {
        const apiRoutes: { [controller: string]: Array<{ fn: string, [method: string]: string }> } = {};

        //Get API Routes.
        this.expressRouter.stack.forEach(item => {
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
            apiRoutes[controllerName].push({ fn: functionName, [method]: (this.apiBaseUrl + path) });
        });

        return apiRoutes;
    }

    /**
     * @returns the SCP `Router` report.
     */
    private scpRouteReport() {
        const scpRoutes: { [messenger: string]: string } = {};

        //Get SCP Routes.
        this.scpServer.routes.forEach(item => {
            //Create Variables.
            const map = String(item.map);
            const type = String(item.type);

            //Add to object.
            scpRoutes[map] = type;
        });

        return scpRoutes;
    }

    /**
     * @returns the SCP `Mesh` report.
     */
    private scpMeshReport() {
        const mesh = new Array();

        //Get SCP Clients.
        this.scpClientManager.clients.forEach(item => {
            const client = {
                name: item.nodeName,
                host: item.url,
                connected: item.connected,
                reconnecting: item.reconnecting,
                disconnected: item.disconnected,
                node: {
                    id: item.node.identifier,
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
     * Binds process events on `SIGTERM` and `SIGINT`.
     */
    private bindProcessEvents() {
        //Exit
        process.once('SIGTERM', () => {
            this.logger.info('Received SIGTERM.');
            this.stop((exitCode: number) => {
                process.exit(exitCode);
            });
        });

        //Ctrl + C
        process.on('SIGINT', () => {
            this.logger.info('Received SIGINT.');
            this.stop((exitCode: number) => {
                process.exit(exitCode);
            });
        });

        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error(`Caught: unhandledRejection ${reason} ${promise}`);
        });
    }
}

//////////////////////////////
//////Type Definitions
//////////////////////////////
/**
 * The optional constructor options for the service.
 */
export type Options = {
    /**
     * The name of the service.
     */
    name?: string;

    /**
     * The version of the service.
     */
    version?: string;

    /**
     * The time to wait before the service is forcefully stopped when `service.stop()`is called.
     */
    forceStopTime?: number;
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

        // apiRouter.get(path, descriptor.value);
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

        // apiRouter.post(path, descriptor.value);
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

        // apiRouter.put(path, descriptor.value);
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

        // apiRouter.delete(path, descriptor.value);
    }
}

//////////////////////////////
//////SCP Server Decorators
//////////////////////////////
/**
 * Interface for `MessageReplyFunction` descriptor.
 */
interface MessageReplyDescriptor extends PropertyDescriptor {
    value: MessageReplyHandler;
}

/**
 * Interface for `ScpServer` decorators.
 */
export interface MessageReplyFunction {
    (target: typeof Messenger, propertyKey: string, descriptor: MessageReplyDescriptor): void;
}

/**
 * Creates a `reply` handler on the `ScpServer`.
 */
export function Reply(): MessageReplyFunction {
    return (target, propertyKey, descriptor) => {
        const messengerName = target.name.replace('Messenger', '');

        const action = messengerName + Action.MAP_BREAK + propertyKey;
        // scpServer.reply(action, descriptor.value);
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
        // if (dbManager.connection) {
        //     const modelName = target.name.replace('Model', '');

        //     //Validate if the database type and model type match.
        //     try {
        //         dbManager.initModel(modelName, entityOptions.name, entityOptions.attributes, target);
        //     } catch (error) {
        //         if (error instanceof ModelError) {
        //             logger.warn(error.message);
        //         } else {
        //             logger.error(error.stack);
        //         }
        //     }
        // }
    }
}