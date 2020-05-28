//Import @iprotechs Modules
import scp, { Body, StatusType, Server as ScpServer, ClientManager, NodeClient, Mesh, MessageReplyHandler, Logging } from '@iprotechs/scp';

//Import Modules
import EventEmitter from 'events';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import express, { Express, Request, Response, NextFunction } from 'express';
import { PathParams, RequestHandler } from 'express-serve-static-core';
import { Server as HttpServer } from 'http';
import cors from 'cors';
import HttpCodes from 'http-status-codes';
import winston, { Logger } from 'winston';
import morgan from 'morgan';
import WinstonDailyRotateFile from 'winston-daily-rotate-file';
import { URL } from 'url';

//Local Imports
import Default from './default';
import Helper from './helper';
import DBManager, { Type as DBType, ConnectionOptionsError } from './db.manager';
import ServiceRoutes from './service.routes';

/**
 * This class is an implementation of a simple and lightweight service.
 * It can be used to implement a service/micro-service.
 * It can communicate with other `Service`'s using SCP(service communication protocol).
 * The HTTP Server is built on top of `Express` and its components.
 * Supports NoSQL(`Mongoose`)/RDB(`Sequelize`), i.e: `mongo`, `mysql`, `postgres`, `sqlite`, `mariadb` and `mssql` databases.
 * Creates default HTTP Endpoints.
 * 
 * Default HTTP Endpoints.
 * - /health - To validate if the service is healthy.
 * - /report - To get all the service reports.
 * - /shutdown - To shutdown the service safely.
 * 
 * @emits `starting` when the service is starting.
 * @emits `ready` when the service is ready to be used to make HTTP calls.
 * @emits `stopping` when the service is in the process of stopping.
 * @emits `stopped` when the service is stopped.
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
     * The HTTP Server port of the service, retrieved from `process.env.HTTP_PORT`.
     * 
     * @default `Default.HTTP_PORT`
     */
    public readonly httpPort: number;

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
     * The root project path of the service.
     */
    public readonly projectPath: string;

    /**
     * The path to log files of the service, retrieved from `process.env.LOG_PATH`.
     * 
     * @default `Default.LOG_PATH`
     */
    public readonly logPath: string;

    /**
     * The functions called before and after each part of the service execution.
     */
    public readonly hooks: Hooks;

    /**
     * The logger instance.
     */
    public readonly logger: Logger;

    /**
     * Instance of `Express` application.
     */
    public readonly express: Express;

    /**
     * Instance of `HttpServer`.
     */
    private _httpServer: HttpServer;

    /**
     * Instance of `ScpServer`.
     */
    public readonly scpServer: ScpServer;

    /**
     * Instance of `ScpClientManager`.
     */
    public readonly scpClientManager: ClientManager;

    /**
     * Instance of `DBManager`.
     */
    public readonly dbManager: DBManager;

    /**
     * Creates an instance of a `Service`.
     * 
     * @param options the optional constructor options.
     */
    public constructor(options?: Options) {
        //Call super for EventEmitter.
        super();

        //Load Environment variables from .env file.
        this.projectPath = path.dirname(require.main.filename);
        const envPath = path.join(this.projectPath, '.env');
        if (fs.existsSync(envPath)) {
            dotenv.config({ path: envPath });
        }

        //Initialize Options.
        options = options || {};

        //Initialize service variables.
        this.name = options.name || process.env.npm_package_name;
        this.version = options.version || process.env.npm_package_version;
        this.forceStopTime = options.forceStopTime || Default.FORCE_STOP_TIME;
        this.environment = process.env.NODE_ENV || Default.ENVIRONMENT;
        this.ip = Helper.getContainerIP();
        this.httpPort = Number(process.env.HTTP_PORT) || Default.HTTP_PORT;
        this.scpPort = Number(process.env.SCP_PORT) || Default.SCP_PORT;
        this.logPath = process.env.LOG_PATH || path.join(this.projectPath, Default.LOG_PATH);

        //Initialize Hooks.
        this.hooks = new Hooks();

        //Initialize Logger.
        this.logger = winston.createLogger();
        this.configLogger();

        //Initialize Express.
        this.express = express();
        this.configExpress();

        //Initialize SCP
        const scpLogger = this.logger.child({ component: 'SCP' });
        const scpLoggerWrite: Logging = {
            action: (identifier, remoteAddress, verbose, action, status, ms) => {
                scpLogger.info(`${identifier}(${remoteAddress}) ${verbose} ${action.map} ${StatusType.getMessage(status)}(${status}) - ${ms} ms`);
            }
        }

        const meshLogger = this.logger.child({ component: 'Mesh' });
        const meshLoggerWrite: Logging = {
            action: (identifier, remoteAddress, verbose, action, status, ms) => {
                meshLogger.info(`${identifier}(${remoteAddress}) ${verbose} ${action.map} ${StatusType.getMessage(status)}(${status}) - ${ms} ms`);
            }
        }

        this.scpServer = scp.createServer({ name: this.name, logging: scpLoggerWrite });
        this.scpClientManager = scp.createClientManager({ name: this.name, mesh: options.mesh, logging: meshLoggerWrite });
        this.configSCP();

        //Initialize DB Manager
        const dbLogger = this.logger.child({ component: 'DB' });
        this.dbManager = new DBManager(dbLogger);
        options.db && this.configDatabase(options.db.type, options.db.paperTrail);

        //Add service routes.
        this.addServiceRoutes();

        //Bind Process Events.
        this.bindProcessEvents();
    }

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    /**
     * Instance of `HttpServer`.
     */
    public get httpServer() {
        return this._httpServer;
    }

    /**
     * The underlying database `Connection`.
     */
    public get connection() {
        return this.dbManager.connection;
    }

    /**
     * The RDB `Connection`.
     */
    public get rdbConnection() {
        return this.dbManager.rdbConnection;
    }

    /**
     * The NoSQL `Connection`.
     */
    public get noSQLConnection() {
        return this.dbManager.noSQLConnection;
    }

    /**
     * `Node`'s are populated into this `Mesh` instance during runtime.
     */
    public get mesh() {
        return this.scpClientManager.mesh;
    }

    //////////////////////////////
    //////Config
    //////////////////////////////
    /**
     * Configures logger by setting up winston.
     */
    private configLogger() {
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
     * Configures HTTP Server by setting up `Express`.
     */
    private configExpress() {
        //Middleware: Setup Basic.
        this.express.use(cors());
        this.express.options('*', cors());
        this.express.use(express.json({ limit: '50mb' }));
        this.express.use(express.urlencoded({ extended: false }));

        //Setup child logger for HTTP.
        const httpLogger = this.logger.child({ component: 'HTTP' });

        //Middleware: Morgan, bind it with Winston.
        this.express.use(morgan('(:remote-addr) :method :url :status - :response-time ms', {
            stream: {
                write: (log: string) => {
                    httpLogger.info(`${log.trim()}`);
                }
            }
        }));

        //Middleware: Proxy pass.
        this.express.use((request: Request, response: Response, next: NextFunction) => {
            //Generate Proxy object from headers.
            Helper.generateProxyObjects(request);
            next();
        });

        //Middleware: Error handler for 404.
        this.hooks.preStart.push(() => {
            this.express.use((request: Request, response: Response, next: NextFunction) => {
                response.status(HttpCodes.NOT_FOUND).send('Not Found');
            });
        });
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
        });
        this.scpClientManager.on('clientDisconnected', (client: NodeClient) => {
            //Log Event.
            this.logger.info(`Node disconnected from ${client.url}`);
        });
        this.scpClientManager.on('clientReconnecting', (client: NodeClient) => {
            //Log Event.
            this.logger.silly(`Node reconnecting to ${client.url}`);
        });
    }

    /**
     * Configures the database by setting up `DBManager`.
     * 
     * @param type the type of the database.
     * @param paperTrail set to true if the paper trail operation should be performed, false otherwise.
     */
    private configDatabase(type: DBType, paperTrail?: boolean) {
        try {
            //Initialize the database connection.
            this.dbManager.init(type, paperTrail);
        } catch (error) {
            if (error instanceof ConnectionOptionsError) {
                this.logger.error(error.message);
            } else {
                this.logger.error(error.stack);
            }
        }
    }

    //////////////////////////////
    //////Init
    //////////////////////////////
    /**
     * Adds the default service routes.
     */
    private addServiceRoutes() {
        //Initialize serviceRoutes.
        const serviceRoutes = new ServiceRoutes(this);

        //Bind functions with the `ServiceRoutes` context.
        serviceRoutes.getHealth = serviceRoutes.getHealth.bind(serviceRoutes);
        serviceRoutes.getReport = serviceRoutes.getReport.bind(serviceRoutes);
        serviceRoutes.shutdown = serviceRoutes.shutdown.bind(serviceRoutes);
        serviceRoutes.syncDatabase = serviceRoutes.syncDatabase.bind(serviceRoutes);

        //Service routes.
        const defaultRouter = this.router();
        defaultRouter.get('/health', serviceRoutes.getHealth);
        defaultRouter.get('/report', serviceRoutes.getReport);
        defaultRouter.get('/shutdown', serviceRoutes.shutdown);
        this.express.use('/', defaultRouter);

        //Database routes.
        if (this.connection) {
            const databaseRouter = this.router();
            databaseRouter.get('/sync', serviceRoutes.syncDatabase);
            this.express.use('/db', databaseRouter);
        }

        //ISSUE: Work from here.
        this.express._router.stack.forEach((middleware: any) => {
            console.log(middleware);
        });
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

        //Run Hook: Pre Start.
        this.hooks.preStart.execute();

        //Start HTTP Server
        this._httpServer = this.express.listen(this.httpPort, () => {
            //Log Event.
            this.logger.info(`HTTP server running on ${this.ip}:${this.httpPort}`);

            //Start SCP Server
            this.scpServer.listen(this.scpPort, () => {
                //Log Event.
                this.logger.info(`SCP server running on ${this.ip}:${this.scpPort}`);

                //Start SCP Client Manager
                (this.scpClientManager.clients.length) && this.scpClientManager.connect(() => {
                    //Log Event.
                    this.logger.info(`SCP client manager connected.`);
                });

                //Start DB Manager
                (this.connection) && this.dbManager.connect((error) => {
                    if (!error) {
                        //Log Event.
                        this.logger.info(`DB client connected to ${this.dbManager.type}://${this.dbManager.host}/${this.dbManager.name}`);
                    } else {
                        if (error instanceof ConnectionOptionsError) {
                            this.logger.error(error.message);
                        } else {
                            this.logger.error(error.stack);
                        }
                    }
                });

                //Run Hook: Post Start.
                this.hooks.postStart.execute();

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

        //Run Hook: Pre Stop.
        this.hooks.preStop.execute();

        setTimeout(() => {
            callback(1);
            this.logger.error('Forcefully shutting down.');
        }, this.forceStopTime);

        //Stop HTTP Servers
        this._httpServer.close((error) => {
            if (!error) {
                //Log Event.
                this.logger.info(`Stopped HTTP server.`);
            }

            //Stop SCP Servers
            this.scpServer.close((error) => {
                if (!error) {
                    //Log Event.
                    this.logger.info(`Stopped SCP Server.`);
                }

                //Stop SCP Client Manager
                (this.scpClientManager.clients.length) && this.scpClientManager.disconnect(() => {
                    //Log Event.
                    this.logger.info(`SCP client manager disconnected.`);
                });

                //Stop DB Manager
                (this.connection) && this.dbManager.disconnect((error) => {
                    if (!error) {
                        //Log Event.
                        this.logger.info(`DB Disconnected.`);
                    }
                });

                //Run Hook: Post Stop.
                this.hooks.postStop.execute();

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
    //////HTTP Server
    //////////////////////////////
    /**
     * Creates a new `ExpressRouter`.
     * 
     * @returns the created router.
     */
    public router() {
        return express.Router();
    }

    /**
     * Mounts the middleware handlers on `Express` at the specified path.
     * 
     * @param path the endpoint path.
     * @param handlers the handlers to be called. The handlers will take request and response as parameters.
     */
    public use(path: PathParams, ...handlers: RequestHandler[]) {
        this.express.use(path, ...handlers);
    }

    /**
     * Creates `all` middlewear handlers on `Express` that works on all HTTP/HTTPs verbose, i.e `get`, `post`, `put`, `delete`, etc...
     * 
     * @param path the endpoint path.
     * @param handlers the handlers to be called. The handlers will take request and response as parameters.
     */
    public all(path: PathParams, ...handlers: RequestHandler[]) {
        this.express.all(path, ...handlers);
    }

    /**
     * Creates `get` middlewear handlers on `Express` that works on `get` HTTP/HTTPs verbose.
     * 
     * @param path the endpoint path.
     * @param handlers the handlers to be called. The handlers will take request and response as parameters.
     */
    public get(path: PathParams, ...handlers: RequestHandler[]) {
        this.express.get(path, ...handlers);
    }

    /**
     * Creates `post` middlewear handlers on `Express` that works on `post` HTTP/HTTPs verbose.
     * 
     * @param path the endpoint path.
     * @param handlers the handlers to be called. The handlers will take request and response as parameters.
     */
    public post(path: PathParams, ...handlers: RequestHandler[]) {
        this.express.post(path, ...handlers);
    }

    /**
     * Creates `put` middlewear handlers on `Express` that works on `put` HTTP/HTTPs verbose.
     * 
     * @param path the endpoint path.
     * @param handlers the handlers to be called. The handlers will take request and response as parameters.
     */
    public put(path: PathParams, ...handlers: RequestHandler[]) {
        this.express.put(path, ...handlers);
    }

    /**
     * Creates `delete` middlewear handlers on `Express` that works on `delete` HTTP/HTTPs verbose.
     * 
     * @param path the endpoint path.
     * @param handlers the handlers to be called. The handlers will take request and response as parameters.
     */
    public delete(path: PathParams, ...handlers: RequestHandler[]) {
        this.express.delete(path, ...handlers);
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
     * Triggers the broadcast action on all the connected services.
     * A broadcast has to be defined `service.defineBroadcast()` before broadcast action can be triggered.
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
     * Retrieve the Node instance by importing `Mesh` from the module.
     *
     * @param url The remote server address.
     * @param nodeName The callable name of the node.
     */
    public defineNode(url: string, nodeName: string) {
        const _url = new URL(`scp://${url}`);
        _url.port = _url.port || Default.SCP_PORT.toString();

        const client = this.scpClientManager.createClient(nodeName, _url.toString());
        client.on('error', (error: Error) => {
            const _error: any = error;

            //Ignore hostname not found.
            if (_error.code === 'ENOTFOUND') {
                return;
            }

            this.logger.error(error.stack);
        });
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
//////Constructor: Options
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

    /**
     * `Node`'s are populated into this `Mesh` during runtime.
     */
    mesh?: Mesh;

    /**
     * The database configuration options.
     */
    db?: {
        /**
         * The type of the database.
         * 
         * Supports NoSQL/RDB types, i.e: `mongo`, `mysql`, `postgres`, `sqlite`, `mariadb` and `mssql` databases.
         */
        type: DBType;

        /**
         * Set to true if the paper trail operation should be performed, false otherwise.
         */
        paperTrail?: boolean;
    }
}

//////////////////////////////
//////Hooks
//////////////////////////////
/**
 * The pre/post hooks of the service.
 */
export class Hooks {
    /**
     * The functions called before the service starts.
     */
    public readonly preStart: Hook;

    /**
     * The functions called after the service has started.
     */
    public readonly postStart: Hook;

    /**
     * The functions called before the service stops.
     */
    public readonly preStop: Hook;

    /**
     * The functions called after the service has stopped.
     */
    public readonly postStop: Hook;

    /**
     * Creates an instance of `Hooks`.
     */
    public constructor() {
        this.preStart = new Hook();
        this.postStart = new Hook();
        this.preStop = new Hook();
        this.postStop = new Hook();
    }
}

/**
 * A Hook is an array of functions that will be executed in reverse order.
 */
export class Hook extends Array<() => void> {
    /**
     * Execute all the functions in reverse order.
     */
    public execute() {
        const reversedFunctions = this.reverse();
        reversedFunctions.forEach(fn => fn());
    }
}