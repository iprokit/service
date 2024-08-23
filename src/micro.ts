//Import @iprotechs Libs.
import { Incoming } from '@iprotechs/scp';

//Import Local.
import Service from './service';
import { Router } from './http.server';
import { Executor } from './scp.server';
import { ForwardOptions } from './http.proxy';

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
function micro(identifier: string) {
    return service ?? (service = new Service(identifier));
}

namespace micro { }

export default micro;

//////////////////////////////
//////Decorators: HTTP
//////////////////////////////
export interface RouterContext {
    name: string;
    path?: string;
    router?: Router;
}

function HTTP(path: string) {
    return (target: RouterContext) => {
        target.path = path;
    }
}

namespace HTTP {
    function routeDecorator(method: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'all') {
        return (path: string) => {
            return (target: RouterContext, key: string, descriptor: PropertyDescriptor) => {
                const _target = resolveTarget<RouterContext>(target);
                _target.router = _target.router || service.Route();
                _target.router[method](path, descriptor.value);
                return descriptor;
            }
        }
    }

    export const Get = routeDecorator('get');
    export const Post = routeDecorator('post');
    export const Put = routeDecorator('put');
    export const Patch = routeDecorator('patch');
    export const Delete = routeDecorator('delete');
    export const All = routeDecorator('all');

    export function forward(identifier: string, options: ForwardOptions) {
        const link = service.linkOf(identifier);
        return link.forward(options);
    }
}

export { HTTP }

//////////////////////////////
//////Decorators: SCP
//////////////////////////////
export interface ExecutorContext {
    name: string;
    operation?: string;
    executor?: Executor;
}

function SCP(operation?: string) {
    return (target: ExecutorContext) => {
        target.operation = operation || target.name;
    }
}

namespace SCP {
    export function broadcast(operation: string, ...args: Array<any>) {
        service.broadcast(operation, ...args);
    }

    export function Omni(operation?: string) {
        return (target: ExecutorContext, key: string, descriptor: PropertyDescriptor) => {
            const _target = resolveTarget<ExecutorContext>(target);
            _target.executor = _target.executor || service.Execution();
            _target.executor.omni(operation || key, descriptor.value);
            return descriptor;
        }
    }

    export function Func(operation?: string) {
        return (target: ExecutorContext, key: string, descriptor: PropertyDescriptor) => {
            const _target = resolveTarget<ExecutorContext>(target);
            _target.executor = _target.executor || service.Execution();
            _target.executor.func(operation || key, descriptor.value);
            return descriptor;
        }
    }

    export function OnBroadcast(identifier: string, operation: string) {
        return (target: ExecutorContext, key: string, descriptor: PropertyDescriptor) => {
            const link = service.linkOf(identifier);
            link.onBroadcast(operation, descriptor.value);
            return descriptor;
        }
    }

    export function omni(identifier: string, operation: string, callback: (incoming: Incoming) => void) {
        const link = service.linkOf(identifier);
        return link.omni(operation, callback);
    }

    export function execute<Returned>(identifier: string, operation: string, ...args: Array<any>) {
        const link = service.linkOf(identifier);
        return link.execute<Returned>(operation, ...args);
    }
}

export { SCP }

//////////////////////////////
//////Helpers
//////////////////////////////
function resolveTarget<T>(target: T) {
    return (typeof target === 'function') ? target as T : target.constructor as T;
}