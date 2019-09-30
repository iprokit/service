//Import modules
import { PathParams, RequestHandler } from "express-serve-static-core";

//Local Imports
import { expressRouter } from "./microservice";
import Controller from "./controller";

//Interface: RequestResponseFunctionDescriptor
interface RequestResponseFunctionDescriptor extends PropertyDescriptor {
    value?: RequestHandler;
}

//Types: RequestResponseFunction
export declare type RequestResponseFunction = (target: typeof Controller, propertyKey: string, descriptor: RequestResponseFunctionDescriptor) => void;

//Types: AppFunction
export declare type AppFunction = (target: Object, propertyKey: string, descriptor: RequestResponseFunctionDescriptor) => void;

/////////////////////////
///////Router Decorators
/////////////////////////
export function Get(path: PathParams): RequestResponseFunction {
    return function (target, propertyKey, descriptor) {
        const controllerName = target.constructor.name.replace('Controller', '').replace('Service', '').replace('Adapter', '').toLowerCase();
        const url = ('/' + controllerName + path);
        expressRouter.get(url, descriptor.value);
    }
}

export function Post(path: PathParams): RequestResponseFunction {
    return function (target, propertyKey, descriptor) {
        const controllerName = target.constructor.name.replace('Controller', '').replace('Service', '').replace('Adapter', '').toLowerCase();
        const url = ('/' + controllerName + path);
        expressRouter.post(url, descriptor.value);
    }
}

export function Put(path: PathParams): RequestResponseFunction {
    return function (target, propertyKey, descriptor) {
        const controllerName = target.constructor.name.replace('Controller', '').replace('Service', '').replace('Adapter', '').toLowerCase();
        const url = ('/' + controllerName + path);
        expressRouter.put(url, descriptor.value);
    }
}

export function Delete(path: PathParams): RequestResponseFunction {
    return function (target, propertyKey, descriptor) {
        const controllerName = target.constructor.name.replace('Controller', '').replace('Service', '').replace('Adapter', '').toLowerCase();
        const url = ('/' + controllerName + path);
        expressRouter.delete(url, descriptor.value);
    }
}

/////////////////////////
///////App Decorators
/////////////////////////
export function Report(path: PathParams): AppFunction {
    return function (target, propertyKey, descriptor) {
        expressRouter.get(path, descriptor.value);
    }
}

export function Execute(path: PathParams): AppFunction {
    return function (target, propertyKey, descriptor) {
        expressRouter.post(path, descriptor.value);
    }
}