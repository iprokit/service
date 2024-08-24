//Import Local.
import Service from './service';
import { Router, RequestHandler } from './http.server';
import { Executor } from './scp.server';

//////////////////////////////
//////Global Variables
//////////////////////////////
/**
 * The singleton instance of `Service`.
 */
let service: Service;

//////////////////////////////
//////Micro: Service
//////////////////////////////
/**
 * Creates a lightweight, singleton instance of `Service` for managing HTTP endpoints and facilitating SCP remote function invocation.
 * It ensures smooth communication and coordination by bridging various protocols and managing remote service interactions.
 * 
 * @param identifier the unique identifier of the service.
 */
export default function micro(identifier: string) {
    return service ?? (service = new Service(identifier));
}

//////////////////////////////
//////Decorators: HTTP
//////////////////////////////
/**
 * Class decorator to define a base path for HTTP routes within a class.
 * 
 * @param path the base path pattern.
 */
function HTTP(path: string) {
    return (target: RouterContext) => {
        target.path = path;
    }
}

namespace HTTP {
    /**
     * Helper function to create a route decorator for a specific HTTP method.
     * 
     * @param method the HTTP method for which the route decorator will be created.
     */
    function routeDecorator(method: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'all') {
        return (path: string, preHandlers?: Array<RequestHandler>, postHandlers?: Array<RequestHandler>) => {
            return (target: RouterContext, key: string, descriptor: PropertyDescriptor) => {
                const _target = resolveTarget<RouterContext>(target);
                _target.router = _target.router || service.Route();
                _target.router[method](path, ...(preHandlers || []), descriptor.value, ...(postHandlers || []));
                return descriptor;
            }
        }
    }

    /**
     * Function decorator to register a HTTP route for handling GET requests.
     * 
     * @param path the path pattern.
     * @param preHandlers the optional request handler functions to be executed before the main handler.
     * @param postHandlers the optional request handler functions to be executed after the main handler.
     */
    export const Get = routeDecorator('get');

    /**
    * Function decorator to register a HTTP route for handling POST requests.
    * 
    * @param path the path pattern.
    * @param preHandlers the optional request handler functions to be executed before the main handler.
    * @param postHandlers the optional request handler functions to be executed after the main handler.
    */
    export const Post = routeDecorator('post');

    /**
    * Function decorator to register a HTTP route for handling PUT requests.
    * 
    * @param path the path pattern.
    * @param preHandlers the optional request handler functions to be executed before the main handler.
    * @param postHandlers the optional request handler functions to be executed after the main handler.
    */
    export const Put = routeDecorator('put');

    /**
    * Function decorator to register a HTTP route for handling PATCH requests.
    * 
    * @param path the path pattern.
    * @param preHandlers the optional request handler functions to be executed before the main handler.
    * @param postHandlers the optional request handler functions to be executed after the main handler.
    */
    export const Patch = routeDecorator('patch');

    /**
    * Function decorator to register a HTTP route for handling DELETE requests.
    * 
    * @param path the path pattern.
    * @param preHandlers the optional request handler functions to be executed before the main handler.
    * @param postHandlers the optional request handler functions to be executed after the main handler.
    */
    export const Delete = routeDecorator('delete');

    /**
    * Function decorator to register a HTTP route for handling all requests.
    * 
    * @param path the path pattern.
    * @param preHandlers the optional request handler functions to be executed before the main handler.
    * @param postHandlers the optional request handler functions to be executed after the main handler.
    */
    export const All = routeDecorator('all');
}

export { HTTP }

export interface RouterContext {
    name: string;
    path?: string;
    router?: Router;
}

//////////////////////////////
//////Decorators: SCP
//////////////////////////////
/**
 * Class decorator to define a segment operation for SCP I/O's and executions within a class.
 * 
 * @param operation the segment operation pattern.
 */
function SCP(operation: string) {
    return (target: ExecutorContext) => {
        target.operation = operation;
    }
}

namespace SCP {
    /**
     * Broadcasts the supplied to all the remote services.
     * 
     * @param operation the operation pattern.
     * @param args the arguments to broadcast.
     */
    export function broadcast(operation: string, ...args: Array<any>) {
        service.broadcast(operation, ...args);
    }

    /**
     * Function decorator to register a SCP execution for handling OMNI I/O.
     * 
     * @param operation the operation pattern.
     */
    export function Omni(operation: string) {
        return (target: ExecutorContext, key: string, descriptor: PropertyDescriptor) => {
            const _target = resolveTarget<ExecutorContext>(target);
            _target.executor = _target.executor || service.Execution();
            _target.executor.omni(operation, descriptor.value);
            return descriptor;
        }
    }

    /**
     * Function decorator to register a SCP function for remote execution.
     * 
     * @param operation the operation pattern.
     */
    export function Func(operation: string) {
        return (target: ExecutorContext, key: string, descriptor: PropertyDescriptor) => {
            const _target = resolveTarget<ExecutorContext>(target);
            _target.executor = _target.executor || service.Execution();
            _target.executor.func(operation, descriptor.value);
            return descriptor;
        }
    }

    /**
     * Function decorator to register a listener for broadcast from the remote service.
     * 
     * @param identifier the unique identifier of the remote service.
     * @param operation the operation pattern.
     */
    export function OnBroadcast(identifier: string, operation: string) {
        return (target: ExecutorContext, key: string, descriptor: PropertyDescriptor) => {
            const link = service.linkOf(identifier);
            link.onBroadcast(operation, descriptor.value);
            return descriptor;
        }
    }
}

export { SCP }

export interface ExecutorContext {
    name: string;
    operation?: string;
    executor?: Executor;
}

//////////////////////////////
//////Link
//////////////////////////////
/**
 * Utilities for interacting with remote services.
 */
namespace Link {
    /**
     * Returns the linked remote service.
     * 
     * @param identifier the unique identifier of the remote service.
     */
    export function of(identifier: string) {
        return service.linkOf(identifier);
    }
}

export { Link }

//////////////////////////////
//////Helpers
//////////////////////////////
/**
 * Helper function that resolves and returns the constructor or function type of the given target.
 * 
 * @param target the target to resolve.
 */
function resolveTarget<T>(target: T) {
    return (typeof target === 'function') ? target as T : target.constructor as T;
}