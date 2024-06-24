//Import @iprotechs Libs.
import { Incoming } from '@iprotechs/scp';

//Import Local.
import Service from './service';
import { Router } from './http.server';
import { Coordinator } from './scp.server';

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
}

export { HTTP }

//////////////////////////////
//////Decorators: SCP
//////////////////////////////
const coordinators = new Map<string, Coordinator>();

function SCP(operation?: string) {
    return (target: any) => {
        const coordinator = coordinators.get(target.name);
        service.attach(operation || target.name, coordinator);
    }
}

namespace SCP {
    export function broadcast(operation: string, data: string, params?: Iterable<readonly [string, string]>) {
        service.broadcast(operation, data, params);
    }

    export function Omni(operation?: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            const name = target.name ?? target.constructor.name;
            const coordinator = coordinators.get(name) || service.Coordinate();
            coordinators.set(name, coordinator);
            coordinator.omni(operation || key, descriptor.value);
            return descriptor;
        }
    }

    //Client
    export function OnBroadcast(identifier: string, operation: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            service.links.get(identifier)?.scpClient.onBroadcast(operation, descriptor.value);
            return descriptor;
        }
    }

    export function omni(identifier: string, operation: string, callback: (incoming: Incoming) => void) {
        return service.links.get(identifier)?.scpClient.omni(operation, callback);
    }
}

export { SCP }