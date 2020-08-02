//Import @iprotechs Modules
import Discovery, { Params as DiscoveryParams, Pod as DiscoveryPod } from '@iprotechs/discovery';
import scp, { Server as ScpServer, Client as ScpClient, ClientManager as ScpClientManager, Mesh, Body, MessageReplyHandler, Logging } from '@iprotechs/scp';

//Import Modules
import { EventEmitter } from 'events';
import fs from 'fs';
import express, { Express, Router, Request, Response, NextFunction, RouterOptions } from 'express';
import { PathParams, RequestHandler } from 'express-serve-static-core';
import { Server as HttpServer } from 'http';
import cors from 'cors';
import winston, { Logger } from 'winston';
import morgan from 'morgan';
import WinstonDailyRotateFile from 'winston-daily-rotate-file';
import ip from 'ip';

//Local Imports
import Default from './default';
import Helper from './helper';
import HttpStatusCodes from './http.statusCodes';
import ServiceRoutes from './service.routes';
import DBManager, { ConnectionOptions, InvalidConnectionOptions } from './db.manager';
import ProxyClientManager, { Proxy } from './proxy.client.manager';
import ProxyClient from './proxy.client';

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
 * 
 * @emits `starting` when the service is in the process of starting.
 * @emits `started` when the service is started.
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
     * Instance of `ProxyClientManager`.
     */
    public readonly proxyClientManager: ProxyClientManager;

    /**
     * Instance of `Discovery`.
     */
    public readonly discovery: Discovery;

    /**
     * A registry of remote services.
     */
    public readonly serviceRegistry: ServiceRegistry;

    /**
     * Instance of `Express` application.
     */
    public readonly express: Express;

    /**
     * Instance of `HttpServer`.
     */
    private _httpServer: HttpServer;

    /**
     * The routes mounted on `Express`.
     */
    public readonly routes: Array<Route>;

    /**
     * Creates an instance of a `Service`.
     * 
     * @param options the constructor options.
     * 
     * @throws `InvalidServiceOptions` when a service option is invalid.
     */
    constructor(options: Options) {
        //Call super for EventEmitter.
        super();

        //Initialize variables.
        this.name = options.name;
        this.version = options.version ?? Default.VERSION;
        this.environment = options.environment ?? Default.ENVIRONMENT;
        this.httpPort = options.httpPort ?? Default.HTTP_PORT;
        this.scpPort = options.scpPort ?? Default.SCP_PORT;
        this.discoveryPort = options.discoveryPort ?? Default.DISCOVERY_PORT;
        this.discoveryIp = options.discoveryIp ?? Default.DISCOVERY_IP;
        this.logPath = options.logPath;

        //Initialize IP.
        this.ip = ip.address();

        //Initialize Hooks.
        this.hooks = new Hooks();

        //Initialize Logger.
        this.logger = winston.createLogger();
        this.configLogger();

        //Initialize DB Manager
        if (options.db) {
            const dbLogger = this.logger.child({ component: 'DB' });
            this.dbManager = new DBManager({ connection: options.db, logger: dbLogger });
        }

        //Initialize SCP Server.
        const scpLogger = this.logger.child({ component: 'SCP' });
        const scpLoggerWrite: Logging = {
            action: (identifier, remoteAddress, verbose, action, status, ms) => {
                scpLogger.info(`${identifier}(${remoteAddress}) ${verbose} ${action.map}(${status}) - ${ms} ms`);
            }
        }
        this.scpServer = scp.createServer({ name: this.name, logging: scpLoggerWrite });
        this.configSCP();

        //Initialize SCP Client Manager.
        const meshLogger = this.logger.child({ component: 'Mesh' });
        const meshLoggerWrite: Logging = {
            action: (identifier, remoteAddress, verbose, action, status, ms) => {
                meshLogger.info(`${identifier}(${remoteAddress}) ${verbose} ${action.map}(${status}) - ${ms} ms`);
            }
        }
        this.scpClientManager = scp.createClientManager({ mesh: options.mesh, logging: meshLoggerWrite });

        //Initialize Proxy Client Manager.
        const proxyLogger = this.logger.child({ component: 'Proxy' });
        this.proxyClientManager = new ProxyClientManager({ proxy: options.proxy, logger: proxyLogger });

        //Initialize Discovery.
        this.discovery = new Discovery(this.name, { scpPort: this.scpPort, httpPort: this.httpPort } as PodParams);

        //Initialize ServiceRegistry.
        this.serviceRegistry = new ServiceRegistry();
        this.configServiceRegistry();

        //Initialize Express.
        this.express = express();
        this.routes = new Array();
        this.configExpress();

        //Add Hooks.
        this.addStartHooks();
        this.addStopHooks();
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

    //////////////////////////////
    //////Config
    //////////////////////////////
    /**
     * Configures logger by setting up winston.
     * 
     * @throws `InvalidServiceOptions` when a service option is invalid.
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
                try {
                    fs.mkdirSync(this.logPath);
                } catch (error) {
                    throw new InvalidServiceOptions('Invalid logPath provided.');
                }
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
     * Configures `ServiceRegistry` by setting up `Discovery`, `ScpClientManager` and `ProxyClientManager`.
     */
    private configServiceRegistry() {
        //Bind Events.
        this.discovery.on('available', (pod: Pod) => {
            //Log Event.
            this.logger.info(`${pod.name}(${pod.id}) available on ${pod.address}`);

            //Try finding the remoteService or create a new one.
            const remoteService = this.serviceRegistry.getByName(pod.name) ?? this.register(pod.name);
            remoteService.update(pod.address, pod.params.httpPort, pod.params.scpPort);

            //Link & Connect.
            remoteService.proxyClient.link(remoteService.address, remoteService.httpPort, () => {
                remoteService.scpClient.connect(remoteService.address, remoteService.scpPort, () => {
                    //Log Event.
                    this.logger.info(`Connected to remote service ${remoteService.name}`);

                    //Emit Global: available.
                    this.emit('available', remoteService);
                });
            });
        });

        this.discovery.on('unavailable', (pod: Pod) => {
            //Log Event.
            this.logger.info(`${pod.name}(${pod.id}) unavailable.`);

            //Try finding the remoteService.
            const remoteService = this.serviceRegistry.getByName(pod.name);

            //Unlink & Disconnect.
            remoteService.proxyClient.unlink(() => {
                remoteService.scpClient.disconnect(() => {
                    //Log Event.
                    this.logger.info(`Disconnected from remote service ${remoteService.name}`);

                    //Emit Global: unavailable.
                    this.emit('unavailable', remoteService);
                });
            });
        });

        this.discovery.on('error', (error: Error) => {
            this.logger.error(error.stack);
        });
    }

    /**
     * Configures HTTP Server by setting up `Express`.
     * 
     * Hooks:
     * - Add preStart hooks for `Express`.
     */
    private configExpress() {
        //Middleware: CORS.
        this.express.use(cors());
        this.express.options('*', cors());

        //Middleware: JSON.
        this.express.use(express.json());

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

        //Middleware: Generate proxy objects.
        this.express.use(Helper.generateProxyObjects);

        //Middleware: Service Unavailable.
        this.express.use((request: Request, response: Response, next: NextFunction) => {
            response.setTimeout(1000 * 60 * 2, () => {
                response.status(HttpStatusCodes.SERVICE_UNAVAILABLE).send({ message: 'Service Unavailable' });
            });

            next();
        });

        //Add PreStart Hook[Top]: Add Service Routes.
        this.hooks.preStart.addToTop((done) => {
            const serviceRoutes = new ServiceRoutes(this);

            //Service routes.
            const serviceRouter = this.createRouter('/');
            serviceRouter.get('/health', Helper.bind(serviceRoutes.getHealth, serviceRoutes));
            serviceRouter.get('/report', Helper.bind(serviceRoutes.getReport, serviceRoutes));

            //Database routes.
            if (this.dbManager) {
                const databaseRouter = this.createRouter('/db');
                databaseRouter.get('/sync', Helper.bind(serviceRoutes.syncDatabase, serviceRoutes));
            }

            done();
        });

        //Add PreStart Hook[Bottom]: Middleware: Error handler for 404.
        this.hooks.preStart.addToBottom((done) => {
            this.express.use((request: Request, response: Response, next: NextFunction) => {
                response.status(HttpStatusCodes.NOT_FOUND).send({ message: 'Not Found' });
            });

            done();
        });
    }

    //////////////////////////////
    //////Hooks
    //////////////////////////////
    /**
     * Add start hooks.
     */
    private addStartHooks() {
        //Connect to DB.
        this.dbManager && this.hooks.start.addToBottom((done) => {
            this.dbManager.connect((error) => {
                if (!error) {
                    //Log Event.
                    this.logger.info(`DB client connected to ${this.dbManager.type}://${this.dbManager.host}/${this.dbManager.name}`);
                } else {
                    if (error instanceof InvalidConnectionOptions) {
                        this.logger.error(error.message);
                    } else {
                        this.logger.error(error.stack);
                    }
                }

                done();
            });
        });

        //Listen on SCP Server.
        this.hooks.start.addToBottom((done) => {
            this.scpServer.listen(this.scpPort, () => {
                //Log Event.
                this.logger.info(`SCP server running on ${this.ip}:${this.scpPort}`);

                done();
            });
        });

        //Bind Discovery.
        this.hooks.start.addToBottom((done) => {
            this.discovery.bind(this.discoveryPort, this.discoveryIp, (error: Error) => {
                if (!error) {
                    //Log Event.
                    this.logger.info(`Discovery running on ${this.discoveryIp}:${this.discoveryPort}`);
                } else {
                    this.logger.error(error.stack);
                }

                done();
            });
        });

        //Listen on HTTP Server.
        this.hooks.start.addToBottom((done) => {
            this._httpServer = this.express.listen(this.httpPort, () => {
                //Log Event.
                this.logger.info(`HTTP server running on ${this.ip}:${this.httpPort}`);

                done();
            });
        });
    }

    /**
     * Add stop hooks.
     */
    private addStopHooks() {
        //Close HTTP Server.
        this.hooks.stop.addToBottom((done) => {
            this._httpServer.close((error) => {
                if (!error) {
                    //Log Event.
                    this.logger.info(`Stopped HTTP server.`);
                }

                done();
            });
        });

        //Close Discovery.
        this.hooks.stop.addToBottom((done) => {
            this.discovery.close((error) => {
                if (!error) {
                    //Log Event.
                    this.logger.info(`Stopped Discovery.`);
                }

                done();
            });
        });

        //Close SCP Server.
        this.hooks.stop.addToBottom((done) => {
            this.scpServer.close((error) => {
                if (!error) {
                    //Log Event.
                    this.logger.info(`Stopped SCP Server.`);
                }

                done();
            });
        });

        //Disconnect from DB.
        this.dbManager && this.hooks.stop.addToBottom((done) => {
            this.dbManager.disconnect((error) => {
                if (!error) {
                    //Log Event.
                    this.logger.info(`DB Disconnected.`);
                }

                done();
            });
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

        //Run Hooks.
        this.hooks.preStart.execute(() => {
            this.hooks.start.execute(() => {
                this.hooks.postStart.execute(() => {
                    //Log Event.
                    this.logger.info(`${this.name} started.`);

                    //Emit Global: started.
                    this.emit('started');

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
     * 
     * @param callback optional callback, called when the service is stopped.
     */
    public stop(callback?: () => void) {
        //Log Event.
        this.logger.info(`Stopping ${this.name}...`);

        //Emit Global: stopping.
        this.emit('stopping');

        //Run Hooks.
        this.hooks.preStop.execute(() => {
            this.hooks.stop.execute(() => {
                this.hooks.postStop.execute(() => {
                    //Log Event.
                    this.logger.info(`${this.name} stopped.`);

                    //Emit Global: stopped.
                    this.emit('stopped');

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

        //Push to routes.
        this.routes.push(new Route(mountPath, router));

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
    //////ServiceRegistry
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

    /**
     * Registeres a new remote service.
     * 
     * Hooks:
     * - Add preStop hooks for `ServiceRegistry`.
     * 
     * @param name the name of the service.
     * @param alias the optional, alias name of the service.
     * @param defined set to true if the service is defined by the consumer, false if auto discovered.
     */
    private register(name: string, alias?: string, defined?: boolean) {
        //Try finding the remoteService by name.
        let _remoteService = this.serviceRegistry.getByName(name);
        if (_remoteService) {
            return _remoteService;
        }

        //Try finding the remoteService by alias.
        _remoteService = this.serviceRegistry.getByAlias(alias);
        if (_remoteService) {
            return _remoteService;
        }

        //Initialize Defaults.
        defined = defined ?? false;
        const traceName = alias ?? name;

        //Create a new `ScpClient`.
        const scpClient = this.scpClientManager.createClient({ name: this.name });
        scpClient.on('error', (error: Error) => {
            this.logger.error(error.stack);
        });
        this.scpClientManager.mount(traceName, scpClient);

        //Create a new `ProxyClient`.
        const proxyClient = this.proxyClientManager.createClient();
        this.proxyClientManager.add(traceName, proxyClient);

        //Add preStop Hook[Bottom]: Unlink & Disconnect.
        this.hooks.preStop.addToBottom((done) => {
            if (proxyClient.linked && scpClient.connected) {
                proxyClient.unlink(() => {
                    scpClient.disconnect(() => {
                        //Log Event.
                        this.logger.info(`Disconnected from remote service ${remoteService.name}`);

                        done();
                    });
                });
            } else {
                done();
            }
        });

        //Create a new `RemoteService` and push to `ServiceRegistry`.
        const remoteService = new RemoteService(name, alias, defined, scpClient, proxyClient);
        this.serviceRegistry.register(remoteService);

        return remoteService;
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
    version?: string;

    /**
     * The environment of the service.
     */
    environment?: string;

    /**
     * The HTTP Server port of the service.
     */
    httpPort?: number;

    /**
     * The SCP Server port of the service.
     */
    scpPort?: number;

    /**
     * The discovery port of the service.
     */
    discoveryPort?: number;

    /**
     * The IP address of discovery, i.e the multicast address.
     */
    discoveryIp?: string;

    /**
     * The path to log files of the service.
     */
    logPath: string;

    /**
     * The database configuration options.
     */
    db?: ConnectionOptions;

    /**
     * `Node`'s are populated into this `Mesh` during runtime.
     */
    mesh?: Mesh;

    /**
     * `ProxyHandler`'s are populated into this `Proxy` during runtime.
     */
    proxy?: Proxy;
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
 * A Hook is an array of handlers that will be executed in series.
 */
export class Hook {
    /**
     * The handler stack.
     */
    public readonly stack: Array<HookHandler>;

    /**
     * Creates an instance of `Hook`.
     */
    constructor() {
        //Initialize stack.
        this.stack = new Array();
    }

    //////////////////////////////
    //////Add
    //////////////////////////////
    /**
     * Add handlers at the start of Hook.
     * 
     * @param handlers the handlers to add.
     */
    public addToTop(...handlers: Array<HookHandler>) {
        this.stack.unshift(...handlers);
    }

    /**
     * Add handlers at the bottom of Hook.
     * 
     * @param handlers the handlers to add.
     */
    public addToBottom(...handlers: Array<HookHandler>) {
        this.stack.push(...handlers);
    }

    //////////////////////////////
    //////Execute
    //////////////////////////////
    /**
     * Execute all the handlers.
     * 
     * @param callback optional callback, called when the handler executions are complete.
     */
    public execute(callback?: () => void) {
        if (this.stack.length > 0) {
            //Initialize the iterator.
            let iterator = 0;

            /**
             * The done handler.
             */
            const done: DoneHandler = () => {
                iterator++;

                if (iterator < this.stack.length) {
                    //CASE: More handlers.
                    this.stack[iterator](done);
                } else {
                    //CASE: Last handler.
                    //Callback.
                    if (callback) {
                        callback();
                    }
                }
            }

            //Start the handler call.
            this.stack[iterator](done);
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
//////ServiceRegistry
//////////////////////////////
/**
 * `ServiceRegistry` is a registry of `RemoteService`'s.
 */
export class ServiceRegistry {
    /**
     * The `RemoteService`'s registered.
     */
    public readonly remoteServices: Array<RemoteService>;

    /**
     * Creates an instance of `ServiceRegistry`.
     */
    constructor() {
        //Initialize remoteServices.
        this.remoteServices = new Array();
    }

    /**
     * True if the all the `RemoteService`'s are connected, false otherwise.
     * `undefined` if no connections.
     */
    public get connected() {
        //Try getting all the remoteService that is defined by the consumer.
        const remoteServices = this.remoteServices.filter(remoteService => remoteService.defined);

        if (remoteServices.length === 0) {
            return undefined;
        }

        //Try getting remoteService that disconnected.
        const remoteService = remoteServices.find(remoteService => !remoteService.scpClient.connected && !remoteService.proxyClient.linked);

        return (remoteService === undefined) ? true : false;
    }

    //////////////////////////////
    //////Array
    //////////////////////////////
    /**
     * Registeres the `RemoteService`.
     * 
     * @param remoteService the remote service.
     */
    public register(remoteService: RemoteService) {
        this.remoteServices.push(remoteService);
    }

    /**
     * Deregisters the `RemoteService`.
     * 
     * @param remoteService the remote service.
     */
    public deregister(remoteService: RemoteService) {
        const index = this.remoteServices.findIndex(_remoteService => remoteService === remoteService);
        this.remoteServices.splice(index, 1);
    }

    /**
     * Returns the `RemoteService` found.
     * 
     * @param name the name of the remote service.
     */
    public getByName(name: string) {
        return this.remoteServices.find(remoteService => remoteService.name === name);
    }

    /**
     * Returns the `RemoteService` found.
     * 
     * @param alias the alias of the remote service.
     */
    public getByAlias(alias: string) {
        return this.remoteServices.find(remoteService => remoteService.alias === alias);
    }
}

/**
 * `RemoteService` is a representation of a service that is remote; in the form of an object.
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
     * True if the service is defined by the consumer, false if auto discovered.
     */
    public readonly defined: boolean;

    /**
     * The instance of `ScpClient`.
     */
    public readonly scpClient: ScpClient;

    /**
     * The instance of `ProxyClient`.
     */
    public readonly proxyClient: ProxyClient;

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
     * @param defined set to true if the service is defined by the consumer, false if auto discovered.
     * @param scpClient the instance of `ScpClient`.
     * @param proxyClient the instance of `ProxyClient`.
     */
    constructor(name: string, alias: string, defined: boolean, scpClient: ScpClient, proxyClient: ProxyClient) {
        //Initialize variables.
        this.name = name;
        this.alias = alias;
        this.defined = defined;
        this.scpClient = scpClient;
        this.proxyClient = proxyClient;
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
//////Route
//////////////////////////////
/**
 * `Route` represents a pointer to the `Router` mounted on `Express`.
 */
export class Route {
    /**
     * The routing path.
     */
    public readonly path: PathParams;

    /**
     * Instance of `Router`.
     */
    public readonly router: Router;

    /**
     * Creates an instance of `Route`.
     * 
     * @param path the routing path.
     * @param router the `Router` instance.
     */
    constructor(path: PathParams, router: Router) {
        //Initialize variables.
        this.path = path;
        this.router = router;
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

//////////////////////////////
//////InvalidServiceOptions
//////////////////////////////
/**
 * `InvalidServiceOptions` is an instance of Error.
 * Thrown when a service option is invalid.
 */
export class InvalidServiceOptions extends Error {
    /**
     * Creates an instance of `InvalidServiceOptions`.
     * 
     * @param message the error message.
     */
    constructor(message: string) {
        super(message);

        // Saving class name in the property of our custom error as a shortcut.
        this.name = this.constructor.name;

        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
    }
}