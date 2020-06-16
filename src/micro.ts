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
import Service, { Options as ServiceOptions } from "./service";
import { Type as DBType, Model, ModelAttributes, ModelError } from './db.manager';
import Controller from "./controller";
import Messenger from './messenger';
import GatewayService from './gateway';

//////////////////////////////
//////Global Variables
//////////////////////////////
/**
 * The root project path of the service.
 */
let projectPath: string;

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
export const models: { [name: string]: Model } = {};

/**
 * The auto injected `Messenger`'s under this service.
 */
export const messengers: { [name: string]: Messenger } = {};

/**
 * The auto injected `Controller`'s under this service.
 */
export const controllers: { [name: string]: Controller } = {};

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
        //Load Environment variables from .env file.
        projectPath = path.dirname(require.main.filename);
        const envPath = path.join(projectPath, '.env');
        if (fs.existsSync(envPath)) {
            dotenv.config({ path: envPath });
        }

        //Initialize Options.
        options = options || {};

        //Initialize serviceOptions.
        const serviceOptions: ServiceOptions = {
            name: options.name || process.env.npm_package_name,
            version: options.version || process.env.npm_package_version,
            environment: process.env.NODE_ENV || Default.ENVIRONMENT,
            httpPort: Number(process.env.HTTP_PORT) || Default.HTTP_PORT,
            scpPort: Number(process.env.SCP_PORT) || Default.SCP_PORT,
            discoveryPort: Number(process.env.DISCOVERY_PORT) || Default.DISCOVERY_PORT,
            discoveryIp: process.env.DISCOVERY_IP || Default.DISCOVERY_IP,
            forceStopTime: options.forceStopTime || Default.FORCE_STOP_TIME,
            logPath: process.env.LOG_PATH || path.join(projectPath, Default.LOG_PATH),
            db: options.db && {
                type: options.db.type,
                host: process.env.DB_HOST,
                name: process.env.DB_NAME,
                username: process.env.DB_USERNAME,
                password: process.env.DB_PASSWORD,
                paperTrail: options.db.paperTrail
            },
            mesh: mesh
        };

        //Create or retrieve the singleton service.
        service = new Service(serviceOptions);

        //Mount PreStart Hook[2]: Inject Files.
        service.hooks.preStart.mount((done) => {
            injectFiles(options.autoWireModel, options.autoInjectMessenger, options.autoInjectController);

            done();
        });

        // service.get('/doc', getDoc);
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
        return service.dbManager && service.dbManager.connection;
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
    const files = Helper.findFilePaths(projectPath, { include: { extension: ['.js'] } });

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
    //Load, the model from the file location.
    const ModelInstance: Model = require(file).default;

    //Add to models.
    models[ModelInstance.name] = ModelInstance;

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

    //Get messengerMeta.
    const messengerMeta = getMessengerMeta(messenger.name);

    //Get messenger name.
    const name = messenger.name.replace('Messenger', '');

    //Get each meta, bind the function and add action to the scpServer.
    messengerMeta.forEach(meta => {
        //Setup a new Action.
        const action = name + Action.MAP_BREAK + meta.handlerName;

        //Add Action.
        service[meta.type](action, Helper.bind(messenger[meta.handlerName], messenger));
    });

    //Add to messengers.
    messengers[name] = messenger;

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
// function getDoc(request: Request, response: Response) {
//     let endpoints: any = {};
//     let schemas: any = {};

//     //Get the endpoints.
//     controllers.forEach(controller => {
//         //Get the model.
//         const model = controller.model;

//         //Get the meta.
//         getControllerMeta(controller.name).forEach(meta => {
//             const parameters = new Array();

//             //Get the route.
//             const route = getRoute(meta.path);
//             route.keys.forEach((key: { name: string, optional: boolean }) => {
//                 parameters.push({
//                     name: key.name,
//                     in: "path",
//                     required: !key.optional,
//                     schema: {
//                         type: 'string'
//                     }
//                 })
//             });

//             //Validate if a path exists and retrieve it.
//             endpoints[meta.path] = endpoints[meta.path] || {};

//             //Add the path object.
//             endpoints[meta.path][meta.method] = {
//                 tags: [meta.name],
//                 operationId: `${meta.name}.${meta.handlerName}`,
//                 parameters: parameters,
//                 responses: {
//                     200: {
//                         content: {
//                             "application/json": {
//                                 schema: {
//                                     type: 'array',
//                                     items: {
//                                         $ref: `#/components/schemas/${model.name}`,
//                                     }
//                                 }
//                             }
//                         },
//                         description: `${meta.name}.${meta.handlerName}`
//                     }
//                 }
//             }
//         });
//     });

//     //Get the RDB models.
//     if (service.dbManager.rdb) {
//         service.dbManager.models.forEach(model => {
//             let required = new Array();
//             let properties: any = {};

//             //Get the attributes.
//             Object.entries(model.rawAttributes).forEach(([key, value]: any) => {
//                 //Add required.
//                 if(!value._autoGenerated){
//                     value.allowNull || required.push(key);
//                 }

//                 //Add properties.
//                 properties[key] = {
//                     type: getModelAttributeType(value.type.toString()),
//                     $ref: value.references && `#/definitions/${getModel(value.references.model).name}`
//                 }

//                 console.log(key, value._autoGenerated, value.allowNull);
//             });

//             schemas[model.name] = {
//                 type: "object",
//                 required: required,
//                 properties: properties
//             }
//         });
//     }
//     // if(service.dbManager.noSQL){
//     //     // console.log(ModelInstance._model.schema);
//     // }

//     const doc = {
//         openapi: "3.0.0",
//         info: {
//             title: service.name,
//             description: process.env.npm_package_description,
//             version: service.version
//         },
//         contact: {
//             name: process.env.npm_package_author_name,
//             email: process.env.npm_package_author_email
//         },
//         basePath: service.httpBaseUrl,
//         paths: endpoints,
//         components: {
//             schemas: schemas
//         }
//     }

//     response.status(HttpCodes.OK).send(doc);
// }

// function getModelAttributeType(attribute: string) {
//     attribute = attribute.toLowerCase();
//     if(attribute.includes('varchar')){
//         attribute = 'string';
//     }
//     if(attribute.includes('datetime')){
//         attribute = 'string';
//     }
//     if(attribute.includes('time')){
//         attribute = 'string';
//     }
//     if(attribute.includes('date')){
//         attribute = 'string';
//     }
//     return attribute;
// }

// /**
//  * Returns the route found.
//  * 
//  * @param path the route/endpoint path.
//  */
// function getRoute(path: string) {
//     return service.expressRouter.stack.find(item => item.route && item.route.path === path);
// }

// /**
//  * Returns the model found.
//  * 
//  * @param name the name of the model.
//  */
// function getModel(name: string) {
//     return models.find(model => model.name.toLowerCase() === name.toLowerCase());
// }