//Import Local.
import Service from './service';

//////////////////////////////
//////Global Variables
//////////////////////////////
/**
 * The singleton instance of `Service`.
 */
export let service: Service;

//////////////////////////////
//////Micro Service
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
/**
 * Decorators for registering HTTP routes.
 */
export namespace HTTP {
    /**
     * Decorator for registering an HTTP route for handling GET requests.
     * 
     * @param path the route path.
     */
    export function Get(path: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            service.get(path, descriptor.value);
            return descriptor;
        }
    }

    /**
     * Decorator for registering an HTTP route for handling POST requests.
     * 
     * @param path the route path.
     */
    export function Post(path: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            service.post(path, descriptor.value);
            return descriptor;
        }
    }

    /**
     * Decorator for registering an HTTP route for handling PUT requests.
     * 
     * @param path the route path.
     */
    export function Put(path: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            service.put(path, descriptor.value);
            return descriptor;
        }
    }

    /**
     * Decorator for registering an HTTP route for handling PATCH requests.
     * 
     * @param path the route path.
     */
    export function Patch(path: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            service.patch(path, descriptor.value);
            return descriptor;
        }
    }

    /**
     * Decorator for registering an HTTP route for handling DELETE requests.
     * 
     * @param path the route path.
     */
    export function Delete(path: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            service.delete(path, descriptor.value);
            return descriptor;
        }
    }

    /**
     * Decorator for registering an HTTP route for handling all requests.
     * 
     * @param path the route path.
     */
    export function All(path: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            service.all(path, descriptor.value);
            return descriptor;
        }
    }
}

//////////////////////////////
//////Decorators: SCP
//////////////////////////////
/**
 * Decorators for registering SCP remote functions.
 */
export namespace SCP {
    /**
     * Decorator for registering an SCP remote function for handling REPLY.
     * 
     * @param operation the operation of the remote function.
     */
    export function Reply(operation: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            service.reply(operation, descriptor.value);
            return descriptor;
        }
    }

    /**
     * Decorator for registering a listener for broadcast events for the linked remote service.
     * 
     * @param identifier the unique identifier of the linked remote service.
     * @param operation the operation of the broadcast.
     */
    export function OnBroadcast(identifier: string, operation: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            service.onBroadcast(identifier, operation, descriptor.value);
            return descriptor;
        }
    }
}