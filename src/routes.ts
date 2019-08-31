//Import modules
import { PathParams } from "express-serve-static-core";

//Local Imports
import { expressRouter } from "./app";
import Controller from "./controller";

/////////////////////////
///////Router Decorators
/////////////////////////
export function Get(path: PathParams) {
    return function (target: typeof Controller, propertyKey: string, descriptor: PropertyDescriptor) {
        const controllerName = target.constructor.name.replace('Controller', '').toLowerCase();
        const url = ('/' + controllerName + path);
        expressRouter.get(url, descriptor.value);
    }
}

export function Post(path: PathParams) {
    return function (target: typeof Controller, propertyKey: string, descriptor: PropertyDescriptor) {
        const controllerName = target.constructor.name.replace('Controller', '').toLowerCase();
        const url = ('/' + controllerName + path);
        expressRouter.post(url, descriptor.value);
    }
}

export function Put(path: PathParams) {
    return function (target: typeof Controller, propertyKey: string, descriptor: PropertyDescriptor) {
        const controllerName = target.constructor.name.replace('Controller', '').toLowerCase();
        const url = ('/' + controllerName + path);
        expressRouter.put(url, descriptor.value);
    }
}

export function Delete(path: PathParams) {
    return function (target: typeof Controller, propertyKey: string, descriptor: PropertyDescriptor) {
        const controllerName = target.constructor.name.replace('Controller', '').toLowerCase();
        const url = ('/' + controllerName + path);
        expressRouter.delete(url, descriptor.value);
    }
}

/////////////////////////
///////App Decorators
/////////////////////////
export function Report(path: PathParams) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        expressRouter.get(path, descriptor.value);
    }
}

export function Execute(path: PathParams) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        expressRouter.post(path, descriptor.value);
    }
}