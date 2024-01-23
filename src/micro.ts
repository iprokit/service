//Import Local.
import Service from './service';
import { Route, HttpMethod } from './http.server';
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
const routes = new Map<string, { basePath: string, stack: Array<Route> }>();

function HTTP(basePath: string) {
    return (target: any) => {
        routes.get(target.name) && (routes.get(target.name).basePath = basePath ?? '');
    }
}

namespace HTTP {
    function RouteDecorator(method: HttpMethod) {
        return (path: string) => {
            return (target: any, key: string, descriptor: PropertyDescriptor) => {
                const targetName = target.name ?? target.constructor.name;
                const targetRoutes = routes.get(targetName) || { basePath: '', stack: [] };
                targetRoutes.stack.push({ method, path, handler: descriptor.value });
                routes.set(targetName, targetRoutes);
                return descriptor;
            }
        }
    }

    export const Get = RouteDecorator('GET');
    export const Post = RouteDecorator('POST');
    export const Put = RouteDecorator('PUT');
    export const Patch = RouteDecorator('PATCH');
    export const Delete = RouteDecorator('DELETE');
    export const All = RouteDecorator('ALL');
}

export { HTTP }

//////////////////////////////
//////Decorators: SCP
//////////////////////////////
const remoteFunctions = new Map<string, Array<RemoteFunction>>();

function SCP(className: string) {
    return (target: any) => {
        remoteFunctions.get(target.name)?.forEach((remoteFunction) => remoteFunction.className = className ?? '');
    }
}

namespace SCP {
    function RemoteFunctionDecorator(mode: Mode) {
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

    export const Reply = RemoteFunctionDecorator('REPLY');

    export function OnBroadcast(identifier: string, operation: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            service.onBroadcast(identifier, operation, descriptor.value);
            return descriptor;
        }
    }
}

export { SCP }