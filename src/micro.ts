//Import @iprotechs Modules
import { Action, Body, MessageReplyHandler, Mesh } from '@iprotechs/scp';

//Import Modules
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import { PathParams, RequestHandler } from 'express-serve-static-core';

//Local Imports
import Default from './default';
import Helper, { FileOptions } from './helper';
import Service, { Options as ServiceOptions } from './service';
import { Type as DBType, Model, ModelAttributes, ModelError } from './db.manager';
import { Proxy } from './proxy.client.manager';
import Controller from './controller';
import Receiver from './receiver';

//////////////////////////////
//////Global Variables
//////////////////////////////
/**
 * Singleton instance of the `Service`.
 */
let service: Service;

/**
 * The auto wired `Model`'s under this service.
 */
export const models: { [name: string]: Model } = {};

/**
 * The auto injected `Receiver`'s under this service.
 */
export const receivers: { [name: string]: Receiver } = {};

/**
 * The auto injected `Controller`'s under this service.
 */
export const controllers: { [name: string]: Controller } = {};

/**
 * An array of `ReceiverMeta`.
 */
const receiverMetas: Array<ReceiverMeta> = new Array();

/**
 * An array of `ControllerMeta`.
 */
const controllerMetas: Array<ControllerMeta> = new Array();

/**
 * `Mesh` is a representation of unique services's in the form of Object's.
 *
 * During runtime:
 * `Node` objects are populated into `Mesh` with its traceName as a get accessor.
 */
export const mesh: Mesh = new Mesh();

/**
 * `Proxy` is an implementation of reverse proxie.
 * 
 * During runtime:
 * `ProxyHandler` functions are populated into `Proxy` with its cellName.
 */
export const proxy: Proxy = new Proxy();

//////////////////////////////
//////Top-level
//////////////////////////////
/**
 * Creates an instance of a singleton service. `micro()` is the top-level function exported by the micro module.
 * 
 * @param options the optional, initialization options.
 * 
 * @returns the service.
 */
function micro(options?: Options) {
    if (!service) {
        //Load Environment variables from .env file.
        const projectPath = path.dirname(require.main.filename);
        const envPath = path.join(projectPath, '.env');
        if (fs.existsSync(envPath)) {
            dotenv.config({ path: envPath });
        }

        //Initialize serviceOptions.
        const serviceOptions: ServiceOptions = {
            name: options?.name ?? process.env.npm_package_name,
            version: options?.version ?? process.env.npm_package_version,
            logPath: process.env.LOG_PATH ?? path.join(projectPath, Default.LOG_PATH),
            mesh: mesh,
            proxy: proxy
        }

        //Validate env variables.
        if (process.env.NODE_ENV) {
            serviceOptions.environment = process.env.NODE_ENV;
        }
        if (process.env.HTTP_PORT) {
            serviceOptions.httpPort = Number(process.env.HTTP_PORT);
        }
        if (process.env.SCP_PORT) {
            serviceOptions.scpPort = Number(process.env.SCP_PORT);
        }
        if (process.env.DISCOVERY_PORT) {
            serviceOptions.discoveryPort = Number(process.env.DISCOVERY_PORT);
        }
        if (process.env.DISCOVERY_IP) {
            serviceOptions.discoveryIp = process.env.DISCOVERY_IP;
        }

        //Initialize serviceOptions for db.
        if (options?.db) {
            serviceOptions.db = {
                type: options.db.type,
                host: process.env.DB_HOST || '',
                name: process.env.DB_NAME || '',
                username: process.env.DB_USERNAME || '',
                password: process.env.DB_PASSWORD || '',
                paperTrail: options.db.paperTrail
            }
        }

        //Create or retrieve the singleton service.
        service = new Service(serviceOptions);

        //Initialize microOptions.
        const forceStopTime = options?.forceStopTime ?? Default.FORCE_STOP_TIME;
        const autoWireModel = options?.autoWireModel ?? { include: { endsWith: ['.model'] } };
        const autoInjectReceiver = options?.autoInjectReceiver ?? { include: { endsWith: ['.receiver'] } };
        const autoInjectController = options?.autoInjectController ?? { include: { endsWith: ['.controller'] } };

        //Add PreStart Hook[Top]: Inject Files.
        service.hooks.preStart.addToTop((done) => {
            injectFiles(projectPath, autoWireModel, autoInjectReceiver, autoInjectController);

            done();
        });
        bindProcessEvents(forceStopTime);
    }

    //Return the singleton service.
    return service;
}

namespace micro {
    /**
     * Triggers the broadcast action on all the connected services.
     * A broadcast has to be defined `micro.defineBroadcast()` before broadcast action can be triggered.
     * 
     * @param action the action.
     * @param body the body to send.
     */
    export function broadcast(action: string, body: Body) {
        service.broadcast(action, body);
    }

    /**
     * The underlying database `Connection`.
     */
    export function connection() {
        return service.dbManager?.connection;
    }

    /**
     * The logger instance.
     */
    export function logger() {
        return service.logger;
    }
}

//Overload Export.
export default micro;

//////////////////////////////
//////Bind
//////////////////////////////
/**
 * Binds process events on `SIGTERM` and `SIGINT`.
 * 
 * @param forceStopTime the time to wait before the service is forcefully stopped.
 */
function bindProcessEvents(forceStopTime: number) {
    /**
     * Stops the service.
     * 
     * @param callback called when the service is stopped.
     */
    const stop = (callback: (exitCode: ExitCode) => void) => {
        /**
         * Stop timeout handler.
         */
        const stopTimeout = setTimeout(() => {
            this.logger.error('Forcefully shutting down.');
            callback(1);
        }, forceStopTime);

        //Call service stop.
        service.stop((error) => {
            //Remove stop timeout handler.
            clearTimeout(stopTimeout);

            let stopCode: ExitCode = 0;
            if (error) {
                this.logger.error(error.stack);
                stopCode = 1;
            }
            callback(stopCode);
        });
    }

    //Exit
    process.once('SIGTERM', () => {
        service.logger.info('Received SIGTERM.');
        stop((exitCode) => {
            process.exit(exitCode);
        });
    });

    //Ctrl + C
    process.on('SIGINT', () => {
        service.logger.info('Received SIGINT.');
        stop((exitCode) => {
            process.exit(exitCode);
        });
    });
}

/**
 * The type definition for exit code.
 * 
 * @type `0` success.
 * @type `1` failure.
 */
type ExitCode = 0 | 1;

//////////////////////////////
//////Injections
//////////////////////////////
/**
 * Inject files into the service. Respecting the order of loading for dependency.
 * The order is as follows; Model, Receiver and finally the Controller.
 * 
 * @param path the path to inject the files from.
 * @param modelOptions the auto wire `Model` options.
 * @param receiverOptions the auto inject `Receiver` options.
 * @param controllerOptions the auto inject `Controller` options.
 */
function injectFiles(path: string, modelOptions: FileOptions, receiverOptions: FileOptions, controllerOptions: FileOptions) {
    /**
     * All the files in this project.
     */
    const files = Helper.findFilePaths(path, { include: { extension: ['.js'] } });

    //Wiring Models.
    files.forEach(file => {
        if (Helper.filterFile(file, modelOptions)) {
            loadModel(file);
        }
    });

    //Injecting Receivers.
    files.forEach(file => {
        if (Helper.filterFile(file, receiverOptions)) {
            loadReceiver(file);
        }
    });

    //Injecting Controllers.
    files.forEach(file => {
        if (Helper.filterFile(file, controllerOptions)) {
            loadController(file);
        }
    });
}

/**
 * Load the `Model` with the following steps.
 * - Call `require()`. DB Decorators are called automatically.
 * - Push to array.
 * 
 * @param file the path of the model.
 */
function loadModel(file: string) {
    //Load, the model from the file location.
    const ModelInstance: Model = require(file).default;

    //Add to models.
    models[ModelInstance.name] = ModelInstance;

    service.logger.debug(`Wiring model: ${ModelInstance.name}`);
}

/**
 * Load the `Receiver` with the following steps.
 * - Call `require()`. SCP Decorators are called automatically, It will add its meta.
 * - Call the receiver constructor.
 * - Get the meta, bind the function to the constructor context.
 * - Push to array.
 * 
 * @param file the path of the receiver.
 */
function loadReceiver(file: string) {
    //Load the receiver from the file location.
    const ReceiverInstance = require(file).default;

    //Initialize the receiver.
    const receiver = new ReceiverInstance();

    //Get receiverMeta.
    const receiverMeta = getReceiverMeta(receiver.name);

    //Get receiver name.
    const name = receiver.name.replace('Receiver', '');

    //Get each meta, bind the function and add action to the scpServer.
    receiverMeta.forEach(meta => {
        //Setup a new Action.
        const action = name + Action.MAP_BREAK + meta.handlerName;

        //Add Action.
        service[meta.type](action, Helper.bind(receiver[meta.handlerName], receiver));
    });

    //Add to receivers.
    receivers[name] = receiver;

    service.logger.debug(`Adding actions from receiver: ${receiver.name}`);
}

/**
 * Load the `Controller` with the following steps.
 * - Call `require()`. HTTP Decorators are called automatically, It will add its meta.
 * - Call the controller constructor.
 * - Get the meta, bind the function to the constructor context.
 * - Push to array.
 * 
 * @param file the path of the controller.
 */
function loadController(file: string) {
    //Load the controller from the file location.
    const ControllerInstance = require(file).default;

    //Initialize the controller.
    const controller = new ControllerInstance();

    //Get controllerMeta.
    const controllerMeta = getControllerMeta(controller.name);

    //Setup a new Router.
    const name = controller.name.replace('Controller', '');
    const router = service.createRouter(`/${name.toLowerCase()}`);

    //Get each meta, bind the function and add route to the router.
    controllerMeta.forEach(meta => {
        //Add Route.
        router[meta.method](meta.relativePath, Helper.bind(controller[meta.handlerName], controller));
    });

    //Add to controllers.
    controllers[name] = controller;

    service.logger.debug(`Adding endpoints from controller: ${controller.name}`);
}

/**
 * Returns an array of receiver metas.
 * 
 * @param name the receiver name.
 */
function getReceiverMeta(name: string) {
    return receiverMetas.filter(receiverMeta => receiverMeta.receiverName === name);
}

/**
 * Returns an array of controller metas.
 * 
 * @param name the controller name.
 */
function getControllerMeta(name: string) {
    return controllerMetas.filter(controllerMeta => controllerMeta.controllerName === name);
}

//////////////////////////////
//////DB Decorators
//////////////////////////////
/**
 * Interface for `Model`.
 */
export interface ModelClass {
    (model: Model): void;
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
 * @param options the entity options.
 */
export function Entity(options: EntityOptions): ModelClass {
    return (model) => {
        if (service.dbManager) {
            const modelName = model.name.replace('Model', '');

            //Validate if the database type and model type match.
            try {
                service.dbManager.initModel(modelName, options.name, options.attributes, model);
            } catch (error) {
                if (error instanceof ModelError) {
                    service.logger.error(error.message);
                } else {
                    service.logger.error(error.stack);
                }
            }
        }
    }
}

//////////////////////////////
//////SCP Server Decorators
//////////////////////////////
/**
 * Interface for `ReplyFunction` descriptor.
 */
export interface ReplyDescriptor extends PropertyDescriptor {
    value: MessageReplyHandler;
}

/**
 * Interface for SCP action.
 */
export interface ReplyFunction {
    (receiver: typeof Receiver, handlerName: string, replyDescriptor: ReplyDescriptor): void;
}

/**
 * Creates a `reply` action on the `ScpServer`.
 */
export function Reply(): ReplyFunction {
    return (receiver, handlerName, replyDescriptor) => {
        receiverMetas.push(new ReceiverMeta(receiver.name, handlerName, 'reply'));
    }
}

//////////////////////////////
//////HTTP Server Decorators
//////////////////////////////
/**
 * Interface for `RequestFunction` descriptor.
 */
export interface RequestDescriptor extends PropertyDescriptor {
    value: RequestHandler;
}

/**
 * Interface for router middlewear.
 */
export interface RequestFunction {
    (controller: typeof Controller, handlerName: string, requestDescriptor: RequestDescriptor): void;
}

/**
 * Creates `get` middlewear handler on the `ExpressRouter` that works on `get` HTTP/HTTPs verbose.
 * 
 * @param path the endpoint path.
 */
export function Get(path: PathParams): RequestFunction {
    return (controller, handlerName, requestDescriptor) => {
        controllerMetas.push(new ControllerMeta(controller.name, handlerName, 'get', path));
    }
}

/**
 * Creates `post` middlewear handler on the `ExpressRouter` that works on `post` HTTP/HTTPs verbose.
 * 
 * @param path the endpoint path.
 */
export function Post(path: PathParams): RequestFunction {
    return (controller, handlerName, requestDescriptor) => {
        controllerMetas.push(new ControllerMeta(controller.name, handlerName, 'post', path));
    }
}

/**
 * Creates `put` middlewear handler on the `ExpressRouter` that works on `put` HTTP/HTTPs verbose.
 * 
 * @param path the endpoint path.
 */
export function Put(path: PathParams): RequestFunction {
    return (controller, handlerName, requestDescriptor) => {
        controllerMetas.push(new ControllerMeta(controller.name, handlerName, 'put', path));
    }
}

/**
 * Creates `delete` middlewear handler on the `ExpressRouter` that works on `delete` HTTP/HTTPs verbose.
 * 
 * @param path the endpoint path.
 */
export function Delete(path: PathParams): RequestFunction {
    return (controller, handlerName, requestDescriptor) => {
        controllerMetas.push(new ControllerMeta(controller.name, handlerName, 'delete', path));
    }
}

//////////////////////////////
//////ReceiverMeta
//////////////////////////////
/**
 * The SCP action types.
 */
export type ScpType = 'reply';

/**
 * Definition of ReceiverMeta.
 */
export class ReceiverMeta {
    /**
     * The constructor name of the receiver.
     */
    public readonly receiverName: string;

    /**
     * The name of the handler.
     */
    public readonly handlerName: string;

    /**
     * The type of the SCP actions.
     */
    public readonly type: ScpType;

    /**
     * Creates an instance of `ReceiverMeta`.
     * 
     * @param className the constructor name of the receiver.
     * @param handlerName the name of the handler.
     * @param type the type of the SCP actions.
     */
    constructor(className: string, handlerName: string, type: ScpType) {
        this.receiverName = className;
        this.handlerName = handlerName;
        this.type = type;
    }
}

//////////////////////////////
//////ControllerMeta
//////////////////////////////
/**
 * The HTTP method types.
 */
export type Method = 'get' | 'post' | 'put' | 'delete';

/**
 * Definition of ControllerMeta.
 */
export class ControllerMeta {
    /**
     * The constructor name of the controller.
     */
    public readonly controllerName: string;

    /**
     * The name of the handler.
     */
    public readonly handlerName: string;

    /**
     * The type of HTTP methods.
     */
    public readonly method: Method;

    /**
     * The relative path of the HTTP endpoint.
     */
    public readonly relativePath: PathParams;

    /**
     * Creates an instance of `ControllerMeta`.
     * 
     * @param controllerName the constructor name of the controller.
     * @param handlerName the name of the handler.
     * @param method the type of HTTP methods.
     * @param relativePath the relative path of the HTTP endpoint.
     */
    constructor(controllerName: string, handlerName: string, method: Method, relativePath: PathParams) {
        this.controllerName = controllerName;
        this.handlerName = handlerName;
        this.method = method;
        this.relativePath = relativePath;
    }
}

//////////////////////////////
//////Entrypoint: Options
//////////////////////////////
/**
 * The optional service configuration.
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

    /**
     * The time to wait before the service is forcefully stopped.
     */
    forceStopTime?: number;

    /**
     * Auto wire `Model` options.
     * 
     * @default
     * { include: { endsWith: ['.model'] } }
     */
    autoWireModel?: FileOptions;

    /**
     * Auto inject `Receiver` options.
     * 
     * @default
     * { include: { endsWith: ['.receiver'] } }
     */
    autoInjectReceiver?: FileOptions;

    /**
     * Auto inject `Controller` options.
     * 
     * @default
     * { include: { endsWith: ['.controller'] } }
     */
    autoInjectController?: FileOptions;
}