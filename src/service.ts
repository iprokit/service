//Import @iprotechs Modules
import Discovery, { Params as DiscoveryParams, Pod as DiscoveryPod } from '@iprotechs/discovery';
import scp, { Server as ScpServer, Client as ScpClient, ClientManager as ScpClientManager, Mesh, Body, StatusType, MessageReplyHandler, Logging } from '@iprotechs/scp';

//Import Modules
import EventEmitter from 'events';
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
import Helper from './helper';
import DBManager, { Options as DbManagerOptions, ConnectionOptionsError } from './db.manager';
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
 * @emits `available` when a remote service is available.
 * @emits `unavailable` when a remote service is unavailable.
 * @emits `stopping` when the service is in the process of stopping.
 * @emits `stopped` when the service is stopped.
 */
export default class Service extends EventEmitter {
    /**
     * The name of the service.
     */
    public readonly name: string;

    /**
     * The version of the service.
     */
    public readonly version: string;

    /**
     * The environment of the service.
     */
    public readonly environment: string;

    /**
     * The HTTP Server port of the service.
     */
    public readonly httpPort: number;

    /**
     * The SCP Server port of the service.
     */
    public readonly scpPort: number;

    /**
     * The discovery port of the service.
     */
    public readonly discoveryPort: number;

    /**
     * The IP address of discovery, i.e the multicast address.
     */
    public readonly discoveryIp: string;

    /**
     * The time to wait before the service is forcefully stopped when `service.stop()`is called.
     */
    public readonly forceStopTime: number;

    /**
     * The path to log files of the service.
     */
    public readonly logPath: string;

    /**
     * The IP address of this service.
     */
    public readonly ip: string;

    /**
     * The functions called before and after each part of the service execution.
     */
    public readonly hooks: Hooks;

    /**
     * The remote services discovered.
     */
    public readonly remoteServices: { [name: string]: RemoteService };

    /**
     * The logger instance.
     */
    public readonly logger: Logger;

    /**
     * Instance of `DBManager`.
     */
    public readonly dbManager: DBManager;

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
     * Instance of `Express` application.
     */
    public readonly express: Express;

    /**
     * Instance of `HttpServer`.
     */
    private _httpServer: HttpServer;

    /**
     * Creates an instance of a `Service`.
     * 
     * @param options the constructor options.
     */
    constructor(options: Options) {
        //Call super for EventEmitter.
        super();

        //Initialize variables.
        this.name = options.name;
        this.version = options.version;
        this.environment = options.environment;
        this.httpPort = options.httpPort;
        this.scpPort = options.scpPort;
        this.discoveryPort = options.discoveryPort;
        this.discoveryIp = options.discoveryIp;
        this.forceStopTime = options.forceStopTime;
        this.logPath = options.logPath;
        this.ip = ip.address();

        //Initialize Hooks.
        this.hooks = new Hooks();

        //Initialize RemoteServices.
        this.remoteServices = {};

        //Initialize Logger.
        this.logger = winston.createLogger();
        this.configLogger();

        //Initialize DB Manager
        if (options.db) {
            const dbLogger = this.logger.child({ component: 'DB' });
            try {
                this.dbManager = new DBManager(dbLogger, options.db);
            } catch (error) {
                if (error instanceof ConnectionOptionsError) {
                    this.logger.error(error.message);
                } else {
                    this.logger.error(error.stack);
                }
            }
        }

        //Initialize SCP Server.
        const scpLogger = this.logger.child({ component: 'SCP' });
        const scpLoggerWrite: Logging = {
            action: (identifier, remoteAddress, verbose, action, status, ms) => {
                scpLogger.info(`${identifier}(${remoteAddress}) ${verbose} ${action.map} ${StatusType.getMessage(status)}(${status}) - ${ms} ms`);
            }
        }
        this.scpServer = scp.createServer({ name: this.name, logging: scpLoggerWrite });
        this.configSCP();

        //Initialize Mesh: SCP Client Manager + Discovery.
        const meshLogger = this.logger.child({ component: 'Mesh' });
        const meshLoggerWrite: Logging = {
            action: (identifier, remoteAddress, verbose, action, status, ms) => {
                meshLogger.info(`${identifier}(${remoteAddress}) ${verbose} ${action.map} ${StatusType.getMessage(status)}(${status}) - ${ms} ms`);
            }
        }
        this.scpClientManager = scp.createClientManager({ mesh: options.mesh, logging: meshLoggerWrite });
        this.discovery = new Discovery(this.name, { scpPort: this.scpPort, httpPort: this.httpPort } as PodParams);
        this.configMesh();

        //Initialize Express: Http Server.
        this.express = express();
        this.configExpress();

        //Initialize Service Routes.
        this.configServiceRoutes();

        //Mount Hooks.
        this.mountStartHooks();
        this.mountStopHooks();

        //Bind Process Events.
        this.bindProcessEvents();
    }

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    /**
     * `Node`'s are populated into this `Mesh` instance during runtime.
     */
    public get mesh() {
        return this.scpClientManager.mesh;
    }

    /**
     * Instance of `HttpServer`.
     */
    public get httpServer() {
        return this._httpServer;
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
            this.logger.info(`${pod.name}(${pod.id}) available on ${pod.address}`);

            //Try finding the remoteService or create a new one.
            const remoteService = this.remoteServices[pod.name] || this.register(pod.name);
            remoteService.update(pod.address, pod.params.httpPort, pod.params.scpPort);

            remoteService.scpClient.connect(remoteService.address, remoteService.scpPort, () => {
                //Log Event.
                this.logger.info(`Mesh connected to ${remoteService.name}(${remoteService.address}:${remoteService.scpPort})`);
            });

            //Emit Global: available.
            this.emit('available', remoteService);
        });

        this.discovery.on('unavailable', (pod: Pod) => {
            //Log Event.
            this.logger.info(`${pod.name}(${pod.id}) unavailable.`);

            //Try finding the remoteService.
            const remoteService = this.remoteServices[pod.name];

            remoteService.scpClient.disconnect(() => {
                //Log Event.
                this.logger.info(`Mesh disconnected from ${remoteService.name}(${remoteService.address}:${remoteService.scpPort})`);
            });

            //Emit Global: unavailable.
            this.emit('unavailable', remoteService);
        });

        this.discovery.on('error', (error: Error) => {
            this.logger.error(error.stack);
        });
    }

    /**
     * Configures HTTP Server by setting up `Express`.
     * 
     * Hooks:
     * - Mounts a preStart hook at index 0.
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
        this.express.use(Helper.generateProxyObjects);

        //Mount PreStart Hook[0]: Middleware: Error handler for 404.
        this.hooks.preStart.mount((done) => {
            this.express.use((request: Request, response: Response, next: NextFunction) => {
                response.status(HttpCodes.NOT_FOUND).send('Not Found');
            });

            done();
        });
    }

    /**
     * Configures default service routes.
     */
    private configServiceRoutes() {
        //Initialize serviceRoutes.
        const serviceRoutes = new ServiceRoutes(this);

        //Bind functions with the `ServiceRoutes` context.
        serviceRoutes.getHealth = serviceRoutes.getHealth.bind(serviceRoutes);
        serviceRoutes.getReport = serviceRoutes.getReport.bind(serviceRoutes);
        serviceRoutes.shutdown = serviceRoutes.shutdown.bind(serviceRoutes);
        serviceRoutes.syncDatabase = serviceRoutes.syncDatabase.bind(serviceRoutes);

        //Service routes.
        const defaultRouter = this.createRouter('/');
        defaultRouter.get('/health', serviceRoutes.getHealth);
        defaultRouter.get('/report', serviceRoutes.getReport);
        defaultRouter.get('/shutdown', serviceRoutes.shutdown);

        //Database routes.
        if (this.dbManager) {
            const databaseRouter = this.createRouter('/db');
            databaseRouter.get('/sync', serviceRoutes.syncDatabase);
        }
    }

    //////////////////////////////
    //////Hooks
    //////////////////////////////
    /**
     * Mount start hooks.
     */
    private mountStartHooks() {
        /**
         * Connect to DB.
         */
        const dbManagerConnect: HookHandler = (done) => {
            this.dbManager.connect((error) => {
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

                done();
            });
        }

        /**
         * Listen on SCP Server.
         */
        const scpServerListen: HookHandler = (done) => {
            this.scpServer.listen(this.scpPort, () => {
                //Log Event.
                this.logger.info(`SCP server running on ${this.ip}:${this.scpPort}`);

                done();
            });
        }

        /**
         * Bind Discovery.
         */
        const discoveryBind: HookHandler = (done) => {
            this.discovery.bind(this.discoveryPort, this.discoveryIp, (error: Error) => {
                if (!error) {
                    //Log Event.
                    this.logger.info(`Discovery running on ${this.discoveryIp}:${this.discoveryPort}`);
                } else {
                    this.logger.error(error.stack);
                }

                done();
            });
        }

        /**
         * Listen on HTTP Server.
         */
        const httpServerListen: HookHandler = (done) => {
            this._httpServer = this.express.listen(this.httpPort, () => {
                //Log Event.
                this.logger.info(`HTTP server running on ${this.ip}:${this.httpPort}`);

                done();
            });
        }

        //Mount hooks.
        this.dbManager && this.hooks.start.mount(dbManagerConnect);
        this.hooks.start.mount(scpServerListen);
        this.hooks.start.mount(discoveryBind);
        this.hooks.start.mount(httpServerListen);
    }

    /**
     * Mount stop hooks.
     */
    private mountStopHooks() {
        /**
         * Disconnect from DB.
         */
        const dbManagerDisconnect: HookHandler = (done) => {
            this.dbManager.disconnect((error) => {
                if (!error) {
                    //Log Event.
                    this.logger.info(`DB Disconnected.`);
                }

                done();
            });
        }

        /**
         * Close SCP Server.
         */
        const scpServerClose: HookHandler = (done) => {
            this.scpServer.close((error) => {
                if (!error) {
                    //Log Event.
                    this.logger.info(`Stopped SCP Server.`);
                }

                done();
            });
        }

        /**
         * Close Discovery.
         */
        const discoveryClose: HookHandler = (done) => {
            this.discovery.close((error) => {
                if (!error) {
                    //Log Event.
                    this.logger.info(`Stopped Discovery.`);
                }

                done();
            });
        }

        /**
         * Close HTTP Server.
         */
        const httpServerClose: HookHandler = (done) => {
            this._httpServer.close((error) => {
                if (!error) {
                    //Log Event.
                    this.logger.info(`Stopped HTTP server.`);
                }

                done();
            });
        }

        //Mount hooks.
        this.dbManager && this.hooks.stop.mount(dbManagerDisconnect);
        this.hooks.stop.mount(scpServerClose);
        this.hooks.stop.mount(discoveryClose);
        this.hooks.stop.mount(httpServerClose);
    }

    //////////////////////////////
    //////Helpers
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

    /**
     * Registeres a new remote service.
     * 
     * @param name the name of the service.
     * @param alias the optional, alias name of the service.
     * @param defined set to true if the service is defined by the user, false if auto discovered.
     */
    private register(name: string, alias?: string, defined?: boolean) {
        //Initialize Defaults.
        defined = (defined === undefined) ? false : defined;

        //Create a new `ScpClient`.
        const client = this.scpClientManager.createClient({ name: this.name });

        //Bind Events.
        client.on('error', (error: Error) => {
            this.logger.error(error.stack);
        });

        //Mount the client.
        this.scpClientManager.mount(alias || name, client);

        //Create a new `RemoteService` and push to `remoteServices`.
        const serviceInstance = new RemoteService(name, alias, defined, client);
        this.remoteServices[name] = serviceInstance;

        return serviceInstance;
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

        //Run Hooks.
        this.hooks.preStart.execute(true, () => {
            this.hooks.start.execute(false, () => {
                this.hooks.postStart.execute(true, () => {
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

        setTimeout(() => {
            callback(1);
            this.logger.error('Forcefully shutting down.');
        }, this.forceStopTime);

        //Run Hooks.
        this.hooks.preStop.execute(true, () => {
            this.hooks.stop.execute(false, () => {
                this.hooks.postStop.execute(true, () => {
                    //Log Event.
                    this.logger.info(`${this.name} stopped.`);

                    //Emit Global: stopped.
                    this.emit('stopped');

                    //Callback.
                    callback(0);
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
    public createRouter(mountPath: PathParams, options?: RouterOptions) {
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
    //////Discovery + SCP Client
    //////////////////////////////
    /**
     * Discovers the service.
     * 
     * @param name the name of the service.
     * @param alias the optional, alias name of the service.
     */
    public discover(name: string, alias?: string) {
        this.register(name, alias, true);

        //Return this for chaining.
        return this;
    }
}

//////////////////////////////
//////Constructor: Options
//////////////////////////////
/**
 * The constructor options for the service.
 */
export type Options = {
    /**
     * The name of the service.
     */
    name: string;

    /**
     * The version of the service.
     */
    version: string;

    /**
     * The environment of the service.
     */
    environment: string;

    /**
     * The HTTP Server port of the service.
     */
    httpPort: number;

    /**
     * The SCP Server port of the service.
     */
    scpPort: number;

    /**
     * The discovery port of the service.
     */
    discoveryPort: number;

    /**
     * The IP address of discovery, i.e the multicast address.
     */
    discoveryIp: string;

    /**
     * The time to wait before the service is forcefully stopped when `service.stop()`is called.
     */
    forceStopTime: number;

    /**
     * The path to log files of the service.
     */
    logPath: string;

    /**
     * `Node`'s are populated into this `Mesh` during runtime.
     */
    mesh?: Mesh;

    /**
     * The database configuration options.
     */
    db?: DbManagerOptions;
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
     * The functions called to start the service.
     */
    public readonly start: Hook;

    /**
     * The functions called after the service has started.
     */
    public readonly postStart: Hook;

    /**
     * The functions called before the service stops.
     */
    public readonly preStop: Hook;

    /**
     * The functions called to stop the service.
     */
    public readonly stop: Hook;

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
        this.start = new Hook();
        this.postStart = new Hook();
        this.preStop = new Hook();
        this.stop = new Hook();
        this.postStop = new Hook();
    }
}

/**
 * A Hook is an array of functions that will be executed.
 */
export class Hook extends Array<HookHandler>{
    /**
     * Mount a hook handler.
     * 
     * @param handler the handler to mount.
     */
    public mount(handler: HookHandler) {
        this.push(handler);
    }

    //////////////////////////////
    //////Execute
    //////////////////////////////
    /**
     * Execute all the functions.
     * 
     * @param reverse set to true if the functions should be executed in reverse order, false otherwise.
     * @param callback optional callback, called when the function executions are complete.
     */
    public execute(reverse: boolean, callback?: () => void) {
        if (this.length > 0) {
            //The handlers to execute.
            const handlers = (reverse === true) ? this.reverse() : this;

            //Initialize the iterator.
            let iterator = 0;

            /**
             * The done handler.
             */
            const done: DoneHandler = () => {
                iterator++;

                if (iterator < handlers.length) {
                    //CASE: More handlers.
                    handlers[iterator](done);
                } else {
                    //CASE: Last handler.
                    //Callback.
                    if (callback) {
                        callback();
                    }
                }
            }

            //Start the handler call.
            handlers[iterator](done);
        } else {
            //Callback.
            if (callback) {
                callback();
            }
        }
    }
}

/**
 * `HookHandler` definition.
 */
export interface HookHandler {
    (done: DoneHandler): void;
}

/**
 * `DoneHandler` definition.
 */
export interface DoneHandler {
    (): void;
}

//////////////////////////////
//////RemoteService
//////////////////////////////
/**
 * `RemoteService` is the metadata for the service discovered.
 */
export class RemoteService {
    /**
     * The name of the service.
     */
    public readonly name: string;

    /**
     * The alias name of the service.
     */
    public readonly alias: string;

    /**
     * True if the service is defined by the user, false if auto discovered.
     */
    public readonly defined: boolean;

    /**
     * The instance of `ScpClient`.
     */
    public readonly scpClient: ScpClient;

    /**
     * The remote address.
     */
    private _address: string;

    /**
     * The remote HTTP port.
     */
    private _httpPort: number;

    /**
     * The remote SCP port.
     */
    private _scpPort: number;

    /**
     * Creates an instance of `RemoteService`.
     * 
     * @param name the name of the service.
     * @param alias the optional, alias name of the service.
     * @param defined set to true if the service is defined by the user, false if auto discovered.
     * @param scpClient the instance of `ScpClient`.
     */
    constructor(name: string, alias: string, defined: boolean, scpClient: ScpClient) {
        //Initialize variables.
        this.name = name;
        this.alias = alias;
        this.defined = defined;
        this.scpClient = scpClient;
    }

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    /**
     * The remote address.
     */
    public get address() {
        return this._address;
    }

    /**
     * The remote HTTP port.
     */
    public get httpPort() {
        return this._httpPort;
    }

    /**
     * The remote SCP port.
     */
    public get scpPort() {
        return this._scpPort;
    }

    //////////////////////////////
    //////Helpers
    //////////////////////////////
    /**
     * Update the remote details.
     * 
     * @param address the remote address.
     * @param httpPort the remote HTTP port.
     * @param scpPort the remte SCP port.
     */
    public update(address: string, httpPort: number, scpPort: number) {
        this._address = address;
        this._httpPort = httpPort;
        this._scpPort = scpPort;
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