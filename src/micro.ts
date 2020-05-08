//Import @iprotechs Modules
import { Action, Body, MessageReplyHandler, Mesh } from '@iprotechs/scp';

//Import Modules
import { Request, Response } from 'express';
import { PathParams, RequestHandler } from 'express-serve-static-core';

//Local Imports
import Service, { Options as ServiceOptions } from "./service";
import GatewayService from './gateway';
import { Type as DBType, Model, ModelAttributes, ModelError } from './db.manager';
import Controller from "./controller";
import Messenger from './messenger';
import Helper, { FileOptions } from './helper';

//////////////////////////////
//////Global Variables
//////////////////////////////
/**
 * Singleton instance of the `Service`.
 */
let service: Service;

/**
 * Singleton instance of the `Gateway`.
 */
let gatewayService: GatewayService;

/**
 * The auto wired `Model`'s under this service.
 */
export const models: Array<Model> = new Array();

/**
 * The auto injected `Messenger`'s under this service.
 */
export const messengers: Array<Messenger> = new Array();

/**
 * The auto injected `Controller`'s under this service.
 */
export const controllers: Array<Controller> = new Array();

/**
 * An array of `MessengerMeta`.
 */
const messengerMetas: Array<MessengerMeta> = new Array();

/**
 * An array of `ControllerMeta`.
 */
const controllerMetas: Array<ControllerMeta> = new Array();

/**
 * `Mesh` is a representation of unique services's in the form of Object's.
 *
 * During runtime:
 * `Node` objects are populated into `Mesh` with its name as a get accessor.
 * All the `Node` objects are populated in this with its node name,
 * which can be declared with `micro.defineNode()`.
 */
export const mesh: Mesh = new Mesh();

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
        //Initialize Options.
        options = options || {};

        //Initialize serviceOptions.
        const serviceOptions: ServiceOptions = options;

        //Initialize mesh.
        serviceOptions.mesh = mesh;

        //Initialize hooks.
        serviceOptions.hooks = {
            preStart: () => {
                //Inject Files.
                injectFiles(options.autoWireModel, options.autoInjectMessenger, options.autoInjectController);
            }
        }

        //Override as gateway if this is a gateway service.
        if (options.gateway) {
            serviceOptions.name = serviceOptions.name || 'gateway';
            serviceOptions.baseUrl = serviceOptions.baseUrl || '/api';
        }

        //Create or retrieve the singleton service.
        service = new Service(serviceOptions);

        service.get('/doc', getDoc);
    }

    //Return the singleton service.
    return service;
}

namespace micro {
    /**
     * Creates an instance of a `Gateway`.
     * 
     * @returns the gateway.
     */
    export function Gateway() {
        //Return the singleton gateway.
        return gatewayService = gatewayService || new GatewayService(service.logger);
    }

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
        return service.connection;
    }

    /**
     * The RDB `Connection`.
     */
    export function rdbConnection() {
        return service.rdbConnection;
    }

    /**
     * The NoSQL `Connection`.
     */
    export function noSQLConnection() {
        return service.noSQLConnection;
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
//////Injections
//////////////////////////////
/**
 * Inject files into the service. Respecting the order of loading for dependency.
 * The order is as follows; Model, Messenger and finally the Controller.
 * 
 * @param modelOptions the auto wire `Model` options.
 * @param messengerOptions the auto inject `Messenger` options.
 * @param controllerOptions the auto inject `Controller` options.
 */
function injectFiles(modelOptions: FileOptions, messengerOptions: FileOptions, controllerOptions: FileOptions) {
    //Initialize Options.
    modelOptions = (modelOptions === undefined) ? { include: { endsWith: ['.model'] } } : modelOptions;
    messengerOptions = (messengerOptions === undefined) ? { include: { endsWith: ['.messenger'] } } : messengerOptions;
    controllerOptions = (controllerOptions === undefined) ? { include: { endsWith: ['.controller'] } } : controllerOptions;

    /**
     * All the files in this project.
     */
    const files = Helper.findFilePaths(service.projectPath, { include: { extension: ['.js'] } });

    //Wiring Models.
    files.forEach(file => {
        if (Helper.filterFile(file, modelOptions)) {
            loadModel(file);
        }
    });

    //Injecting Messengers.
    files.forEach(file => {
        if (Helper.filterFile(file, messengerOptions)) {
            loadMessenger(file);
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
    //Load, Initialize, Push to array.
    const ModelInstance: Model = require(file).default;
    models.push(ModelInstance);

    //Log Event.
    service.logger.debug(`Wiring model: ${ModelInstance.name}`);
}

/**
 * Load the `Messenger` with the following steps.
 * - Call `require()`. SCP Decorators are called automatically, It will add its meta.
 * - Call the messenger constructor.
 * - Get the meta, bind the function to the constructor context.
 * - Push to array.
 * 
 * @param file the path of the messenger.
 */
function loadMessenger(file: string) {
    //Load the messenger from the file location.
    const MessengerInstance = require(file).default;

    //Initialize the messenger.
    const messenger = new MessengerInstance();

    //Get messengerMeta and name.
    let messengerMeta = getMessengerMeta(messenger.name);

    //Get each meta, bind the function and add action to the scpServer.
    messengerMeta && messengerMeta.forEach(meta => {
        //Bind Function.
        messenger[meta.handlerName] = messenger[meta.handlerName].bind(messenger);

        //Add Action.
        service[meta.type](meta.action, messenger[meta.handlerName]);
    });

    //Push to array.
    messengers.push(messenger);

    //Log Event.
    service.logger.debug(`Adding actions from messenger: ${messenger.name}`);
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

    //Get controllerMeta and name.
    let controllerMeta = getControllerMeta(controller.name);

    //Get each meta, bind the function and add route to the router.
    controllerMeta && controllerMeta.forEach(meta => {
        //Bind Function.
        controller[meta.handlerName] = controller[meta.handlerName].bind(controller);

        //Add Route.
        service[meta.method](meta.path, controller[meta.handlerName]);
    });

    //Push to array.
    controllers.push(controller);

    //Log Event.
    service.logger.debug(`Adding endpoints from controller: ${controller.name}`);
}

/**
 * Returns an array of messenger metas.
 * 
 * @param name the messenger name.
 */
function getMessengerMeta(name: string) {
    return messengerMetas.filter(messengerMeta => messengerMeta.messengerName === name);
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
 * @param options the entity options.
 */
export function Entity(options: EntityOptions): ModelClass {
    return (target) => {
        if (service.dbManager.connection) {
            const modelName = target.name.replace('Model', '');

            //Validate if the database type and model type match.
            try {
                service.dbManager.initModel(modelName, options.name, options.attributes, target);
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
    (messenger: typeof Messenger, handlerName: string, replyDescriptor: ReplyDescriptor): void;
}

/**
 * Creates a `reply` action on the `ScpServer`.
 */
export function Reply(): ReplyFunction {
    return (messenger, handlerName, replyDescriptor) => {
        messengerMetas.push(new MessengerMeta(messenger.name, handlerName, 'reply'));
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
    (controller: typeof Controller, handlerName: string, requestDescriptor: RequestDescriptor): void
};

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
//////MessengerMeta
//////////////////////////////
/**
 * The SCP action types.
 */
export type ScpType = 'reply';

/**
 * Definition of MessengerMeta.
 */
export class MessengerMeta {
    /**
     * The constructor name of the messenger.
     */
    public readonly messengerName: string;

    /**
     * The name of the handler.
     */
    public readonly handlerName: string;

    /**
     * The type of the SCP actions.
     */
    public readonly type: ScpType;

    /**
     * Creates an instance of `MessengerMeta`.
     * 
     * @param className the constructor name of the messenger.
     * @param handlerName the name of the handler.
     * @param type the type of the SCP actions.
     */
    constructor(className: string, handlerName: string, type: ScpType) {
        this.messengerName = className;
        this.handlerName = handlerName;
        this.type = type;
    }

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    /**
     * The name of the messenger.
     */
    public get name() {
        return this.messengerName.replace('Messenger', '');
    }

    /**
     * The SCP `Action`.
     */
    public get action() {
        return this.name + Action.MAP_BREAK + this.handlerName;
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

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    /**
     * The name of the controller.
     */
    public get name() {
        return this.controllerName.replace('Controller', '').toLowerCase();
    }

    /**
     * The absolute path of the HTTP endpoint.
     */
    public get path() {
        return `/${this.name}${this.relativePath}`;
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
     * The base URL of the service.
     */
    baseUrl?: string;

    /**
     * The version of the service.
     */
    version?: string;

    /**
     * The time to wait before the service is forcefully stopped when `service.stop()`is called.
     */
    forceStopTime?: number;

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
     * Set to true if this is a `gateway` service, false otherwise.
     */
    gateway?: boolean;

    /**
     * Auto wire `Model` options.
     * 
     * @default
     * { include: { endsWith: ['.model'] } }
     */
    autoWireModel?: FileOptions;

    /**
     * Auto inject `Messenger` options.
     * 
     * @default
     * { include: { endsWith: ['.messenger'] } }
     */
    autoInjectMessenger?: FileOptions;

    /**
     * Auto inject `Controller` options.
     * 
     * @default
     * { include: { endsWith: ['.controller'] } }
     */
    autoInjectController?: FileOptions;
}

//////////////////////////////
//////Doc
//////////////////////////////
function getDoc(request: Request, response: Response) {
    let paths: any = {};

    controllers.forEach(controller => {
        const model = controller.model;

        //Get Controller Meta.
        getControllerMeta(controller.name).forEach(meta => {
            /**
             * TODO: Work from here.
             * 
             * Post is not working because its being replaced by the latest attribute.
             * Need to figure out a way to append to the existing object.
             */

            paths[meta.path] = {
                [meta.method]: {
                    tags: [meta.name],
                    operationId: `${meta.controllerName}.${meta.handlerName}`,
                    consumes: ["application/json"],
                    produces: ["application/json"],
                    parameters: [
                        {
                            schema: {
                                "$ref": `#/definitions/${model.name}`
                            }
                        }
                    ],
                }
            };
        });
    });

    const doc = {
        openapi: "3.0.0",
        info: {
            title: service.name,
            version: service.version
        },
        paths: paths,
        definitions: {}
    }

    response.status(200).send(doc);
}