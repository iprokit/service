//Import @iprotechs Modules
import { Action, Body, MessageReplyHandler, Mesh } from '@iprotechs/scp';

//Import Modules
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
 * The autoinjected `Messenger`'s under this service.
 */
export const messengers: Array<Messenger> = new Array();

/**
 * The autoinjected `Controller`'s under this service.
 */
export const controllers: Array<Controller> = new Array();

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
    //Initialize Options.
    options = options || {};

    //Initialize serviceOptions.
    const serviceOptions: ServiceOptions = options;

    //Override mesh.
    serviceOptions.mesh = mesh;

    //Override as gateway if this is a gateway service.
    if (options.gateway) {
        serviceOptions.name = serviceOptions.name || 'gateway';
        serviceOptions.baseUrl = serviceOptions.baseUrl || '/api';
    }

    //Create or retrieve the singleton service.
    service = service || new Service(serviceOptions);

    //Inject Files.
    injectFiles(options.autoWireModel, options.autoInjectMessenger, options.autoInjectController);

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
//////Helpers
//////////////////////////////
/**
 * Inject files into the service. Respecting the order of loading for dependency.
 * 
 * Order: Model, Messenger, Controller
 * 
 * After each `require()`, decorator will automatically be called.
 * Allowing it to be binded to its parent component, i.e: dbManager(Model), Service(Messenger, Controller).
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
            //Load, Initialize, Push to array.
            const ModelInstance: Model = require(file).default;
            models.push(ModelInstance);

            //Log Event.
            service.logger.debug(`Wiring model: ${ModelInstance.name}`);
        }
    });

    //Injecting Messengers.
    files.forEach(file => {
        if (Helper.filterFile(file, messengerOptions)) {
            //Load, Initialize, Push to array.
            const MessengerInstance = require(file).default;
            const messenger: Messenger = new MessengerInstance();
            messengers.push(messenger);

            //Log Event.
            service.logger.debug(`Adding actions from messenger: ${messenger.name}`);
        }
    });

    //Injecting Controllers.
    files.forEach(file => {
        if (Helper.filterFile(file, controllerOptions)) {
            //Load, Initialize, Push to array.
            const ControllerInstance = require(file).default;
            const controller: ControllerMeta = new ControllerInstance();
            const controllerName = controller.name.replace('Controller', '').toLowerCase();

            if (controller.metas) {
                controller.metas.forEach(meta => {
                    if (!meta.rootPath) {
                        meta.path = ('/' + controllerName + meta.path);
                    }

                    switch (meta.method) {
                        case 'GET':
                            service.get(meta.path, controller[meta.functionName].bind(controller));
                            break;
                        case 'POST':
                            service.post(meta.path, controller[meta.functionName].bind(controller));
                            break;
                        case 'PUT':
                            service.put(meta.path, controller[meta.functionName].bind(controller));
                            break;
                        case 'DELETE':
                            service.delete(meta.path, controller[meta.functionName].bind(controller));
                            break;
                    }
                });
            }

            controllers.push(controller);

            //Log Event.
            service.logger.debug(`Adding endpoints from controller: ${controller.name}`);
        }
    });
}

interface ControllerMeta extends Controller {
    metas: Array<{ functionName: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: PathParams, rootPath: boolean }>;

    [functionName: string]: any;
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
    (controller: ControllerMeta, fnName: string, fn: RequestResponseFunctionDescriptor): void
};

/**
 * Creates `get` middlewear handler on the API `Router` that works on `get` HTTP/HTTPs verbose.
 * 
 * @param path the endpoint path.
 * @param rootPath set to true if the path is root path, false by default.
 */
export function Get(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (controller, functionName, descriptor) => {
        //Try adding metas if they dont exist.
        if (!controller.metas) {
            controller.metas = new Array();
        }

        //Add Meta to metas
        controller.metas.push({ functionName: functionName, method: 'GET', path: path, rootPath });
    }
}

/**
 * Creates `post` middlewear handler on the API `Router` that works on `post` HTTP/HTTPs verbose.
 * 
 * @param path the endpoint path.
 * @param rootPath set to true if the path is root path, false by default.
 */
export function Post(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (controller, functionName, descriptor) => {
        //Try adding metas if they dont exist.
        if (!controller.metas) {
            controller.metas = new Array();
        }

        //Add Meta to metas
        controller.metas.push({ functionName: functionName, method: 'POST', path: path, rootPath });
    }
}

/**
 * Creates `put` middlewear handler on the API `Router` that works on `put` HTTP/HTTPs verbose.
 * 
 * @param path the endpoint path.
 * @param rootPath set to true if the path is root path, false by default.
 */
export function Put(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (controller, functionName, descriptor) => {
        //Try adding metas if they dont exist.
        if (!controller.metas) {
            controller.metas = new Array();
        }

        //Add Meta to metas
        controller.metas.push({ functionName: functionName, method: 'PUT', path: path, rootPath });
    }
}

/**
 * Creates `delete` middlewear handler on the API `Router` that works on `delete` HTTP/HTTPs verbose.
 * 
 * @param path the endpoint path.
 * @param rootPath set to true if the path is root path, false by default.
 */
export function Delete(path: PathParams, rootPath?: boolean): RequestResponseFunction {
    return (controller, functionName, descriptor) => {
        //Try adding metas if they dont exist.
        if (!controller.metas) {
            controller.metas = new Array();
        }

        //Add Meta to metas
        controller.metas.push({ functionName: functionName, method: 'DELETE', path: path, rootPath });
    }
}

//////////////////////////////
//////SCP Server Decorators
//////////////////////////////
/**
 * Interface for `MessageReplyFunction` descriptor.
 */
export interface MessageReplyDescriptor extends PropertyDescriptor {
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
        service.reply(action, descriptor.value);
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
        if (service.dbManager.connection) {
            const modelName = target.name.replace('Model', '');

            //Validate if the database type and model type match.
            try {
                service.dbManager.initModel(modelName, entityOptions.name, entityOptions.attributes, target);
            } catch (error) {
                if (error instanceof ModelError) {
                    service.logger.warn(error.message);
                } else {
                    service.logger.error(error.stack);
                }
            }
        }
    }
}