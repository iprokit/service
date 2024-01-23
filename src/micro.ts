//Import Local.
import Service from './service';
import { Route } from './http.server';
import { RemoteFunction } from './scp.server';

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
function HTTP(basePath: string) {
    return (target: any) => {
        target.prototype.basePath = basePath;
        for (const { method, path, handler } of target.prototype.routes as Array<Route>) {
            (service as any)[method.toLowerCase()](basePath + path, handler);
        }
    }
}

namespace HTTP {
    export function Get(path: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            target.routes = [{ method: 'GET', path, handler: descriptor.value } as Route, ...(target.routes || [])];
            return descriptor;
        }
    }

    export function Post(path: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            target.routes = [{ method: 'POST', path, handler: descriptor.value } as Route, ...(target.routes || [])];
            return descriptor;
        }
    }

    export function Put(path: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            target.routes = [{ method: 'PUT', path, handler: descriptor.value } as Route, ...(target.routes || [])];
            return descriptor;
        }
    }

    export function Patch(path: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            target.routes = [{ method: 'PATCH', path, handler: descriptor.value } as Route, ...(target.routes || [])];
            return descriptor;
        }
    }

    export function Delete(path: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            target.routes = [{ method: 'DELETE', path, handler: descriptor.value } as Route, ...(target.routes || [])];
            return descriptor;
        }
    }

    export function All(path: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            target.routes = [{ method: 'ALL', path, handler: descriptor.value } as Route, ...(target.routes || [])];
            return descriptor;
        }
    }
}

export { HTTP }

//////////////////////////////
//////Decorators: SCP
//////////////////////////////
function SCP(className: string) {
    return (target: any) => {
        target.className = className;
        for (const { mode, functionName, handler } of target.remoteFunctions as Array<RemoteFunction>) {
            (service as any)[mode.toLowerCase()](`${className}${RemoteFunction.CLASS_BREAK}${functionName}`, handler);
        }
    }
}

namespace SCP {
    export function Reply(functionName?: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            functionName = functionName ?? key;
            target.remoteFunctions = [{ mode: 'REPLY', functionName, handler: descriptor.value } as RemoteFunction, ...(target.remoteFunctions || [])];
            return descriptor;
        }
    }

    export function OnBroadcast(identifier: string, operation: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            service.onBroadcast(identifier, operation, descriptor.value);
            return descriptor;
        }
    }
}

export { SCP }