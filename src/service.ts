//Import @iprotechs Modules
import Discovery, { Params as DiscoveryParams, Pod as DiscoveryPod } from '@iprotechs/discovery';
import scp, { Server as ScpServer, Client as ScpClient, ClientManager as ScpClientManager, Mesh, Body, StatusType, MessageReplyHandler, ClientOptions, Logging } from '@iprotechs/scp';

//Import Modules
import EventEmitter from 'events';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import express, { Express, Request, Response, NextFunction, RouterOptions } from 'express';
import { PathParams, RequestHandler } from 'express-serve-static-core';
import { Server as HttpServer } from 'http';
import cors from 'cors';
import HttpCodes from 'http-status-codes';
import winston, { Logger } from 'winston';
import morgan from 'morgan';
import WinstonDailyRotateFile from 'winston-daily-rotate-file';
import ip from 'ip';

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
     * The discovery port of the service., retrieved from `process.env.DISCOVERY_PORT`.
     * 
     * @default `Default.DISCOVERY_PORT`
     */
    public readonly discoveryPort: number;

    /**
     * The IP address of discovery, i.e the multicast address.
     * 
     * @default `Default.DISCOVERY_IP`
     */
    public readonly discoveryIp: string;

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
     * The root project path of the service.
     */
    public readonly projectPath: string;

    /**
     * The IP address of this service.
     */
    public readonly ip: string;

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
    public readonly scpClientManager: ScpClientManager;

    /**
     * Instance of `Discovery`.
     */
    public readonly discovery: Discovery;

    /**
     * Instance of `DBManager`.
     */
    public readonly dbManager: DBManager;

    /**
     * Creates an instance of a `Service`.
     * 
     * @param options the optional constructor options.
     */
    constructor(options?: Options) {
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
        this.environment = process.env.NODE_ENV || Default.ENVIRONMENT;
        this.httpPort = Number(process.env.HTTP_PORT) || Default.HTTP_PORT;
        this.scpPort = Number(process.env.SCP_PORT) || Default.SCP_PORT;
        this.discoveryPort = Number(process.env.DISCOVERY_PORT) || Default.DISCOVERY_PORT;
        this.discoveryIp = process.env.DISCOVERY_IP || Default.DISCOVERY_IP;
        this.forceStopTime = options.forceStopTime || Default.FORCE_STOP_TIME;
        this.logPath = process.env.LOG_PATH || path.join(this.projectPath, Default.LOG_PATH);
        this.ip = ip.address();

        //Initialize Hooks.
        this.hooks = new Hooks();

        //Initialize Logger.
        this.logger = winston.createLogger();
        this.configLogger();

        //Initialize Express.
        this.express = express();
        this.configExpress();

        //Initialize SCP.
        const scpLogger = this.logger.child({ component: 'SCP' });
        const scpLoggerWrite: Logging = {
            action: (identifier, remoteAddress, verbose, action, status, ms) => {
                scpLogger.info(`${identifier}(${remoteAddress}) ${verbose} ${action.map} ${StatusType.getMessage(status)}(${status}) - ${ms} ms`);
            }
        }
        this.scpServer = scp.createServer({ name: this.name, logging: scpLoggerWrite });
        this.configSCP();

        //Initialize Mesh.
        const meshLogger = this.logger.child({ component: 'Mesh' });
        const meshLoggerWrite: Logging = {
            action: (identifier, remoteAddress, verbose, action, status, ms) => {
                meshLogger.info(`${identifier}(${remoteAddress}) ${verbose} ${action.map} ${StatusType.getMessage(status)}(${status}) - ${ms} ms`);
            }
        }
        this.scpClientManager = scp.createClientManager({ mesh: options.mesh, logging: meshLoggerWrite });
        this.discovery = new Discovery(this.name, { scpPort: this.scpPort, httpPort: this.httpPort } as PodParams);
        this.configMesh();

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

        //Add Hook: PreStart.
        this.hooks.preStart.push(() => {
            //Middleware: Error handler for 404.
            this.express.use((request: Request, response: Response, next: NextFunction) => {
                response.status(HttpCodes.NOT_FOUND).send('Not Found');
            });
        });
    }

    /**
     * Configures SCP by setting up `ScpServer`.
     */
    private configSCP() {
        //Bind Events.
        this.scpServer.on('error', (error: Error) => {
            this.logger.error(error.stack);
        });
    }

    /**
     * Configures Mesh by setting up `ScpClientManager` and `Discovery`.
     */
    private configMesh() {
        //Bind Events.
        this.discovery.on('available', (pod: Pod) => {
            //Log Event.
            this.logger.info(`${pod.id}(${pod.name}) available on ${pod.address}:${pod.params.scpPort}`);

            //Try finding the trace.
            const trace = this.scpClientManager.traces.find(trace => trace.client.name === pod.name);

            let client: ScpClient;
            if (trace) {
                //CASE: Trace found.
                client = trace.client;
            } else {
                //CASE: No trace found.
                client = this.createScpClient(pod.name, { name: pod.name });
            }

            client.connect(pod.address, pod.params.scpPort, () => {
                //Log Event.
                this.logger.info(`Mesh connected to ${pod.name}(${client.hostname}:${client.port})`);
            });
        });

        this.discovery.on('unavailable', (pod: Pod) => {
            //Log Event.
            this.logger.info(`${pod.id}(${pod.name}) unavailable.`);

            //Try finding the trace.
            const trace = this.scpClientManager.traces.find(trace => trace.client.name === pod.name);

            if(trace) {
                trace.client.disconnect(() => {
                    //Log Event.
                    this.logger.info(`Mesh disconnected from ${pod.name}(${trace.client.hostname}:${trace.client.port})`);
                });
            }
        });

        this.discovery.on('error', (error: Error) => {
            this.logger.error(error.stack);
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
    //////Helpers
    //////////////////////////////
    /**
     * Adds the default service routes.
     */
    private addServiceRoutes() {
        //Add Hook: PreStart.
        this.hooks.preStart.push(() => {
            //Initialize serviceRoutes.
            const serviceRoutes = new ServiceRoutes(this);

            //Bind functions with the `ServiceRoutes` context.
            serviceRoutes.getHealth = serviceRoutes.getHealth.bind(serviceRoutes);
            serviceRoutes.getReport = serviceRoutes.getReport.bind(serviceRoutes);
            serviceRoutes.shutdown = serviceRoutes.shutdown.bind(serviceRoutes);
            serviceRoutes.syncDatabase = serviceRoutes.syncDatabase.bind(serviceRoutes);

            //Service routes.
            const defaultRouter = this.router('/');
            defaultRouter.get('/health', serviceRoutes.getHealth);
            defaultRouter.get('/report', serviceRoutes.getReport);
            defaultRouter.get('/shutdown', serviceRoutes.shutdown);

            //Database routes.
            if (this.connection) {
                const databaseRouter = this.router('/db');
                databaseRouter.get('/sync', serviceRoutes.syncDatabase);
            }
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

                //Start Discovery
                this.discovery.bind(this.discoveryPort, this.discoveryIp, (error: Error) => {
                    if (!error) {
                        //Log Event.
                        this.logger.info(`Discovery running on ${this.discoveryIp}:${this.discoveryPort}`);
                    } else {
                        this.logger.error(error.stack);
                    }

                    //Start DB Manager
                    this.dbManager.connect((connection, error) => {
                        if (connection) {
                            //Log Event.
                            this.logger.info(`DB client connected to ${this.dbManager.type}://${this.dbManager.host}/${this.dbManager.name}`);
                        }
                        if (error) {
                            if (error instanceof ConnectionOptionsError) {
                                this.logger.error(error.message);
                            } else {
                                this.logger.error(error.stack);
                            }
                        }

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
            });
        });

        //Return this for chaining.
        return this;
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

                //Stop Discovery
                this.discovery.close((error) => {
                    if (!error) {
                        //Log Event.
                        this.logger.info(`Stopped Discovery.`);
                    }

                    //Stop DB Manager
                    this.dbManager.disconnect((error) => {
                        if (!error) {
                            //Log Event.
                            this.logger.info(`DB Disconnected.`);
                        }

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
            });
        });

        //Return this for chaining.
        return this;
    }

    //////////////////////////////
    //////HTTP Server
    //////////////////////////////
    /**
     * Creates a new `ExpressRouter`.
     * 
     * @param mountPath the path this router should be mounted on.
     * @param options the optional, router options.
     * 
     * @returns the created router.
     */
    public router(mountPath: PathParams, options?: RouterOptions) {
        //Create a new router.
        const router = express.Router(options);

        //Add mountPath to the router.
        (router as any).mountPath = mountPath;

        //Mount the router to express.
        this.express.use(mountPath, router);

        //Return the router.
        return router;
    }

    /**
     * Mounts the middleware handlers on `Express` at the specified path.
     * 
     * @param path the endpoint path.
     * @param handlers the handlers to be called. The handlers will take request and response as parameters.
     */
    public use(path: PathParams, ...handlers: RequestHandler[]) {
        this.express.use(path, ...handlers);

        //Return this for chaining.
        return this;
    }

    /**
     * Creates `all` middlewear handlers on `Express` that works on all HTTP/HTTPs verbose, i.e `get`, `post`, `put`, `delete`, etc...
     * 
     * @param path the endpoint path.
     * @param handlers the handlers to be called. The handlers will take request and response as parameters.
     */
    public all(path: PathParams, ...handlers: RequestHandler[]) {
        this.express.all(path, ...handlers);

        //Return this for chaining.
        return this;
    }

    /**
     * Creates `get` middlewear handlers on `Express` that works on `get` HTTP/HTTPs verbose.
     * 
     * @param path the endpoint path.
     * @param handlers the handlers to be called. The handlers will take request and response as parameters.
     */
    public get(path: PathParams, ...handlers: RequestHandler[]) {
        this.express.get(path, ...handlers);

        //Return this for chaining.
        return this;
    }

    /**
     * Creates `post` middlewear handlers on `Express` that works on `post` HTTP/HTTPs verbose.
     * 
     * @param path the endpoint path.
     * @param handlers the handlers to be called. The handlers will take request and response as parameters.
     */
    public post(path: PathParams, ...handlers: RequestHandler[]) {
        this.express.post(path, ...handlers);

        //Return this for chaining.
        return this;
    }

    /**
     * Creates `put` middlewear handlers on `Express` that works on `put` HTTP/HTTPs verbose.
     * 
     * @param path the endpoint path.
     * @param handlers the handlers to be called. The handlers will take request and response as parameters.
     */
    public put(path: PathParams, ...handlers: RequestHandler[]) {
        this.express.put(path, ...handlers);

        //Return this for chaining.
        return this;
    }

    /**
     * Creates `delete` middlewear handlers on `Express` that works on `delete` HTTP/HTTPs verbose.
     * 
     * @param path the endpoint path.
     * @param handlers the handlers to be called. The handlers will take request and response as parameters.
     */
    public delete(path: PathParams, ...handlers: RequestHandler[]) {
        this.express.delete(path, ...handlers);

        //Return this for chaining.
        return this;
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

        //Return this for chaining.
        return this;
    }

    /**
     * Defines a SCP broadcast action on the `ScpServer`.
     * 
     * @param action the action.
     */
    public defineBroadcast(action: string) {
        this.scpServer.defineBroadcast(action);

        //Return this for chaining.
        return this;
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

        //Return this for chaining.
        return this;
    }

    //////////////////////////////
    //////SCP Client Manager
    //////////////////////////////
    /**
     * Creates a SCP `Client` and mounts it on the SCP `ClientManager`.
     * 
     * @param traceName the trace name to mount the client on.
     * @param options the optional, creation options.
     */
    public createScpClient(traceName: string, options?: ClientOptions) {
        const client = this.scpClientManager.createClient(options);

        //Bind Events.
        client.on('error', (error: Error) => {
            this.logger.error(error.stack);
        });

        this.scpClientManager.mount(traceName, client);

        return client;
    }

    //////////////////////////////
    //////Discovery + SCP
    //////////////////////////////
    /**
     * Discovers the node, `source` name as the `target` name.
     * 
     * @param source the source name of the node.
     * @param target the target name of the node.
     */
    public discoverNodeAs(source: string, target: string) {
        this.createScpClient(target, { name: source });

        //Return this for chaining.
        return this;
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
    constructor() {
        //Initialize variables.
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

//////////////////////////////
//////Interfaces
//////////////////////////////
/**
 * Wrapper for `DiscoveryPod`.
 */
export interface Pod extends DiscoveryPod {
    /**
     * The parameters of the service.
     */
    params: PodParams;
}

/**
 * Wrapper for `DiscoveryParams`.
 */
export interface PodParams extends DiscoveryParams {
    /**
     * The HTTP port.
     */
    httpPort: number;

    /**
     * The SCP port.
     */
    scpPort: number;
}