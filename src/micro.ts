//Import Local.
import Service from './service';
import { Router } from './http.server';
import { RemoteFunction, Mode } from './scp.server';

//////////////////////////////
//////Global Variables
//////////////////////////////
/**
 * The singleton instance of `Service`.
 */
export let service: Service;

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

function HTTP(path?: string) {
    return (target: any) => {
        const router = routers.get(target.name);
        service.mount(path || '/', router);
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
}

export { HTTP }

//////////////////////////////
//////Decorators: SCP
//////////////////////////////
const remoteFunctions = new Map<string, Array<RemoteFunction>>();

function SCP(className?: string) {
    return (target: any) => {
        remoteFunctions.get(target.name)?.forEach((remoteFunction) => remoteFunction.className = className ?? target.name);
    }
}

namespace SCP {
    function remoteFunctionDecorator(mode: Mode) {
        return (functionName?: string) => {
            return (target: any, key: string, descriptor: PropertyDescriptor) => {
                const targetName = target.name ?? target.constructor.name;
                const targetRemoteFunctions = remoteFunctions.get(targetName) || [];
                targetRemoteFunctions.push({ mode, functionName: functionName ?? key, handler: descriptor.value } as RemoteFunction);
                remoteFunctions.set(targetName, targetRemoteFunctions);
                return descriptor;
            }
        }
    }

    export const Reply = remoteFunctionDecorator('REPLY');

    export function OnBroadcast(identifier: string, operation: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            service.onBroadcast(identifier, operation, descriptor.value);
            return descriptor;
        }
    }
}

export { SCP }