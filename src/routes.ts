//Import modules
import { PathParams, RequestHandler } from "express-serve-static-core";

//Local Imports
import { expressRouter } from "./app";
import Controller from "./controller";

//Interface: RouterFunctionDescriptor
interface RouterFunctionDescriptor extends PropertyDescriptor {
    value?: RequestHandler;
}

//Interface: AppFunctionDescriptor
interface AppFunctionDescriptor extends PropertyDescriptor {
    value?: RequestHandler;
}

//Types: RouterFunction
export declare type RouterFunction = (target: typeof Controller, propertyKey: string, descriptor: RouterFunctionDescriptor) => void;

//Types: AppFunction
export declare type AppFunction = (target: Object, propertyKey: string, descriptor: AppFunctionDescriptor) => void;

/////////////////////////
///////Router Decorators
/////////////////////////
export function Get(path: PathParams): RouterFunction {
    return function (target, propertyKey, descriptor) {
        const controllerName = target.constructor.name.replace('Controller', '').toLowerCase();
        const url = ('/' + controllerName + path);
        expressRouter.get(url, descriptor.value);
    }
}

export function Post(path: PathParams): RouterFunction {
    return function (target, propertyKey, descriptor) {
        const controllerName = target.constructor.name.replace('Controller', '').toLowerCase();
        const url = ('/' + controllerName + path);
        expressRouter.post(url, descriptor.value);
    }
}

export function Put(path: PathParams): RouterFunction {
    return function (target, propertyKey, descriptor) {
        const controllerName = target.constructor.name.replace('Controller', '').toLowerCase();
        const url = ('/' + controllerName + path);
        expressRouter.put(url, descriptor.value);
    }
}

export function Delete(path: PathParams): RouterFunction {
    return function (target, propertyKey, descriptor) {
        const controllerName = target.constructor.name.replace('Controller', '').toLowerCase();
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