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
//////Micro:Service
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
const routers = new Map<string, Router>();

function HTTP(path: string) {
    return (target: any) => {
        const router = routers.get(target.name);
        service.mount(path, router);
    }
}

namespace HTTP {
    function routeDecorator(method: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'all') {
        return (path: string) => {
            return (target: any, key: string, descriptor: PropertyDescriptor) => {
                const name = target.name ?? target.constructor.name;
                const router = routers.get(name) || service.Route();
                routers.set(name, router);
                router[method](path, descriptor.value);
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
const executors = new Map<string, Executor>();

function SCP(operation?: string) {
    return (target: any) => {
        const executor = executors.get(target.name);
        service.attach(operation || target.name, executor);
    }
}

namespace SCP {
    export function broadcast(operation: string, ...args: Array<any>) {
        service.broadcast(operation, ...args);
    }

    export function Omni(operation?: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            const name = target.name ?? target.constructor.name;
            const executor = executors.get(name) || service.Execution();
            executors.set(name, executor);
            executor.omni(operation || key, descriptor.value);
            return descriptor;
        }
    }

    export function func(operation?: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            const name = target.name ?? target.constructor.name;
            const executor = executors.get(name) || service.Execution();
            executors.set(name, executor);
            executor.func(operation || key, descriptor.value);
            return descriptor;
        }
    }

    export function OnBroadcast(identifier: string, operation: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
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