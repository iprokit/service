//Import @iprotechs Libs.
import Discovery, { Params as DiscoveryParams, Pod as DiscoveryPod } from '@iprotechs/discovery';
import { Server as ScpServer, Node, Mesh, ReplyAsyncFunction } from '@iprotechs/scp';

//Import Libs.
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

//Import Local.
import Default from './default';
import Helper from './helper';
import HttpStatusCodes from './http.statusCodes';
import ServiceRoutes from './service.routes';
import DBManager, { ConnectionOptions } from './db.manager';
import Proxy, { ProxyHandler } from './proxy';

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
     * Instance of `Mesh`.
     */
    public readonly mesh: Mesh;

    /**
     * Instance of `Proxy`.
     */
    public readonly proxy: Proxy;

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
     * The routers mounted on `Express`.
     */
    public readonly routers: Array<ExpressRouter>;

    /**
     * Creates an instance of a `Service`.
     * 
     * @param options the constructor options.
     * 
     * @throws `InvalidServiceOptions` when a service option is invalid.
     */
    constructor(options: Options) {
        super();

        //Initialize Options.
        this.name = options.name;
        this.version = options.version ?? Default.VERSION;
        this.environment = options.environment ?? Default.ENVIRONMENT;
        this.httpPort = options.httpPort ?? Default.HTTP_PORT;
        this.scpPort = options.scpPort ?? Default.SCP_PORT;
        this.discoveryPort = options.discoveryPort ?? Default.DISCOVERY_PORT;
        this.discoveryIp = options.discoveryIp ?? Default.DISCOVERY_IP;
        this.logPath = options.logPath;
        this.mesh = options.mesh ?? new Mesh();
        this.proxy = options.proxy ?? new Proxy();

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
        this.scpServer = new ScpServer(this.name);
        this.configSCP();

        //Initialize Mesh.
        (this.mesh as any).name = this.name;

        //Initialize Discovery.
        this.discovery = new Discovery(this.name, { scpPort: this.scpPort, httpPort: this.httpPort } as PodParams);

        //Initialize ServiceRegistry.
        this.serviceRegistry = new ServiceRegistry();
        this.configServiceRegistry();

        //Initialize Express.
        this.express = express();
        this.routers = new Array();
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
        this.scpServer.on('error', (error: Error) => {
            this.logger.error(error.stack);
        });
    }

    /**
     * Configures `ServiceRegistry` by setting up `Discovery`, `ScpClientManager` and `ProxyHandler`.
     */
    private configServiceRegistry() {
        this.discovery.on('available', (pod: Pod) => {
            this.logger.info(`${pod.name}(${pod.id}) available on ${pod.address}`);

            //Try finding the remoteService or create a new one and connect.
            const remoteService = this.serviceRegistry.getByName(pod.name) ?? this.register(pod.name);
            remoteService.connect(pod.address, pod.params.httpPort, pod.params.scpPort, () => {
                this.logger.info(`Connected to remote service ${remoteService.name}`);
                this.emit('available', remoteService);
            });
        });

        this.discovery.on('unavailable', (pod: Pod) => {
            this.logger.info(`${pod.name}(${pod.id}) unavailable.`);

            //Try finding the remoteService and disconnect.
            const remoteService = this.serviceRegistry.getByName(pod.name);
            remoteService.disconnect(() => {
                this.logger.info(`Disconnected from remote service ${remoteService.name}`);
                this.emit('unavailable', remoteService);
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
        //Set environment.
        this.express.set('env', this.environment);

        //Middleware: CORS.
        this.express.use(cors());
        this.express.options('*', cors());

        // //Middleware: JSON.
        // this.express.use(express.json());

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

        //Add PreStart Hook[Bottom]: Add Service Routes.
        this.hooks.preStart.addToBottom((done) => {
            const serviceRoutes = new ServiceRoutes(this);

            //Service routes.
            const serviceRouter = this.createRouter('/');
            serviceRouter.use(express.json())
            serviceRouter.get('/health', Helper.bind(serviceRoutes.getHealth, serviceRoutes));
            serviceRouter.get('/report', Helper.bind(serviceRoutes.getReport, serviceRoutes));

            //Database routes.
            if (this.dbManager) {
                const databaseRouter = this.createRouter('/db');
                databaseRouter.use(express.json())
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
        this.dbManager && this.hooks.start.addToBottom((done) => {
            this.dbManager.connect((error) => {
                error || this.logger.info(`DB client connected to ${this.dbManager.type}://${this.dbManager.host}/${this.dbManager.name}`);
                done(error);
            });
        });
        this.hooks.start.addToBottom((done) => {
            this.scpServer.listen(this.scpPort, () => {
                this.logger.info(`SCP server running on ${this.ip}:${this.scpPort}`);
                done();
            });
        });
        this.hooks.start.addToBottom((done) => {
            this.discovery.bind(this.discoveryPort, this.discoveryIp, (error: Error) => {
                error || this.logger.info(`Discovery running on ${this.discoveryIp}:${this.discoveryPort}`);
                done(error);
            });
        });
        this.hooks.start.addToBottom((done) => {
            this._httpServer = this.express.listen(this.httpPort, () => {
                this.logger.info(`HTTP server running on ${this.ip}:${this.httpPort}`);
                done();
            });
        });
    }

    /**
     * Add stop hooks.
     */
    private addStopHooks() {
        this.hooks.stop.addToBottom((done) => {
            this._httpServer.close((error) => {
                error || this.logger.info(`Stopped HTTP server.`);
                done(error);
            });
        });
        this.hooks.stop.addToBottom((done) => {
            this.discovery.close((error) => {
                error || this.logger.info(`Stopped Discovery.`);
                done(error);
            });
        });
        this.hooks.stop.addToBottom((done) => {
            this.scpServer.close((error) => {
                error || this.logger.info(`Stopped SCP Server.`);
                done(error);
            });
        });
        this.dbManager && this.hooks.stop.addToBottom((done) => {
            this.dbManager.disconnect((error) => {
                error || this.logger.info(`DB Disconnected.`);
                done(error);
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
    public start(callback?: (error?: Error) => void) {
        this.logger.info(`Starting ${this.name} v.${this.version} in ${this.environment} environment.`);

        this.emit('starting');
        this.hooks.executeStart((error) => {
            this.logger.info(`${this.name} started.`);

            this.emit('started');

            callback && callback(error);
        });
        return this;
    }

    /**
     * Stops the service.
     * 
     * @param callback optional callback, called when the service is stopped.
     */
    public stop(callback?: (error?: Error) => void) {
        this.logger.info(`Stopping ${this.name}...`);

        this.emit('stopping');
        this.hooks.executeStop((error) => {
            this.logger.info(`${this.name} stopped.`);

            this.emit('stopped');

            callback && callback(error);
        });
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
        const router = express.Router(options);
        this.routers.push(new ExpressRouter(mountPath, router));
        this.express.use(mountPath, router);
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
        return this;
    }

    //////////////////////////////
    //////SCP Server
    //////////////////////////////
    /**
     * Creates asynchronous remote reply function that can be executed by all the client socket connections.
     * 
     * @param map the map of the remote reply function.
     * @param replyFunction the reply function to execute.
     */
    public reply<Message, Reply>(map: string, replyFunction: ReplyAsyncFunction<Message, Reply>) {
        this.scpServer.replyAsync(map, replyFunction);
        return this;
    }

    /**
     * Registers a broadcast.
     * 
     * @param map the map of the broadcast.
     */
    public registerBroadcast(map: string) {
        this.scpServer.registerBroadcast(map);
        return this;
    }

    /**
     * Broadcasts the supplied body to all the client socket connections.
     * 
     * @param map the map of the broadcast.
     * @param body the optional body to broadcast.
     */
    public broadcast<Body>(map: string, body?: Body) {
        return this.scpServer.broadcast(map, body);
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

        //Create a new `Node`.
        const node = this.mesh.mount(traceName);
        node.on('error', (error: Error) => {
            this.logger.error(error.stack);
        });

        //Create a new `ProxyHandler`.
        const proxyHandler = this.proxy.mount(traceName);
        proxyHandler.on('forward', (source, target) => {
            this.logger.info(`${source.path} -> http://${target.host}:${target.port}${target.path}`, { component: 'Proxy' });
        });

        //Create a new `RemoteService` and push to `ServiceRegistry`.
        const remoteService = new RemoteService(name, alias, defined, node, proxyHandler);
        this.serviceRegistry.register(remoteService);

        //Add preStop Hook[Bottom]: Disconnect.
        this.hooks.preStop.addToBottom((done) => {
            if (remoteService.connected) {
                remoteService.disconnect(() => {
                    this.logger.info(`Disconnected from remote service ${remoteService.name}`);

                    done();
                });
            } else {
                done();
            }
        });

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
     * Executes SCP remote functions.
     */
    mesh?: Mesh;

    /**
     * Forwards HTTP request/response.
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
        this.preStart = new Hook();
        this.start = new Hook();
        this.postStart = new Hook();
        this.preStop = new Hook();
        this.stop = new Hook();
        this.postStop = new Hook();
    }

    //////////////////////////////
    //////Execute
    //////////////////////////////
    /**
     * Execute start(preStart, start, postStart) sequence hooks.
     * 
     * @param callback optional callback, called when start sequence is complete.
     */
    public executeStart(callback?: (error?: Error) => void) {
        let _error: Error;

        this.preStart.execute((error) => {
            _error = error ?? _error;
            this.start.execute((error) => {
                _error = error ?? _error;
                this.postStart.execute((error) => {
                    _error = error ?? _error;
                    callback && callback(_error);
                });
            });
        });
    }

    /**
     * Execute stop(preStop, stop, postStop) sequence hooks.
     * 
     * @param callback optional callback, called when stop sequence is complete.
     */
    public executeStop(callback?: (error?: Error) => void) {
        let _error: Error;

        this.preStop.execute((error) => {
            _error = error ?? _error;
            this.stop.execute((error) => {
                _error = error ?? _error;
                this.postStop.execute((error) => {
                    _error = error ?? _error;
                    callback && callback(_error);
                });
            });
        });
    }
}

/**
 * A Hook is an array of handlers that will be executed in sequence.
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
    public execute(callback?: (error?: Error) => void) {
        if (this.stack.length > 0) {
            //Initialize the iterator.
            let iterator = 0;

            //Initialize the error.
            let _error: Error;

            /**
             * The done handler.
             * 
             * @param error the error caught.
             */
            const done: DoneHandler = (error?: Error) => {
                //Iterate to the next done.
                iterator++;

                //Pass the error to the next done.
                _error = error ?? _error;

                if (iterator < this.stack.length) {
                    //CASE: More handlers.
                    this.stack[iterator](done);
                } else {
                    //CASE: Last handler.
                    callback && callback(_error);
                }
            }

            //Start the handler call.
            this.stack[iterator](done);
        } else {
            callback && callback();
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
 * 
 * @param error the error caught.
 */
export interface DoneHandler {
    (error?: Error): void;
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
        this.remoteServices = new Array();
    }

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
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
        const remoteService = remoteServices.find(remoteService => !remoteService.node.connected && !remoteService.proxyHandler.linked);

        return (remoteService === undefined) ? true : false;
    }

    //////////////////////////////
    //////Register/Deregister
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
        const index = this.remoteServices.findIndex(_remoteService => _remoteService === remoteService);
        this.remoteServices.splice(index, 1);
    }

    //////////////////////////////
    //////Get
    //////////////////////////////
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
     * The instance of `Node`.
     */
    public readonly node: Node;

    /**
     * The instance of `ProxyHandler`.
     */
    public readonly proxyHandler: ProxyHandler;

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
     * @param node the instance of `Node`.
     * @param proxyHandler the instance of `ProxyHandler`.
     */
    constructor(name: string, alias: string, defined: boolean, node: Node, proxyHandler: ProxyHandler) {
        this.name = name;
        this.alias = alias;
        this.defined = defined;
        this.node = node;
        this.proxyHandler = proxyHandler;
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

    /**
     * True if the remote service is connected, false if disconnected.
     */
    public get connected() {
        return this.proxyHandler.linked && this.node.connected;
    }

    //////////////////////////////
    //////Connection Management
    //////////////////////////////
    /**
     * Connect to the remote service.
     * 
     * @param address the remote address.
     * @param httpPort the remote HTTP port.
     * @param scpPort the remote SCP port.
     * @param callback optional callback. Will be called once connected.
     */
    public connect(address: string, httpPort: number, scpPort: number, callback?: () => void) {
        this._address = address;
        this._httpPort = httpPort;
        this._scpPort = scpPort;

        this.proxyHandler.link(this._httpPort, this._address);
        this.node.connect(this._scpPort, this._address, callback);
    }

    /**
     * Disconnect from the remote service.
     * 
     * @param callback optional callback. Will be called once disconnected.
     */
    public disconnect(callback?: () => void) {
        this.proxyHandler.unlink();
        this.node.disconnect(callback);
    }
}

//////////////////////////////
//////ExpressRouter
//////////////////////////////
/**
 * `ExpressRouter` represents a pointer to the `Router` mounted on `Express`.
 */
export class ExpressRouter {
    /**
     * The routing path.
     */
    public readonly path: PathParams;

    /**
     * Instance of `Router`.
     */
    public readonly router: Router;

    /**
     * Creates an instance of `ExpressRouter`.
     * 
     * @param path the routing path.
     * @param router the `Router` instance.
     */
    constructor(path: PathParams, router: Router) {
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