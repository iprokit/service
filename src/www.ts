//Import modules
import Promise from 'bluebird';
import { EventEmitter } from 'events';
import express, { Express, Router, Request, Response, NextFunction } from 'express';
import { PathParams, RequestHandler } from 'express-serve-static-core';
import { Server as HttpServer } from 'http';
import cors from 'cors';
import createError from 'http-errors';

//Local Imports
import { Server, Events, Defaults } from './microservice';
import Utility from './utility';
import Controller from './controller';

//Types: RouteOptions
export type RouteMethod = 'get' | 'post' | 'put' | 'delete';
export type RouteOptions = {
    name: string,
    method: RouteMethod,
    path: PathParams
}

export default class WWW extends EventEmitter implements Server {
    //Server Variables.
    public readonly baseUrl: string;
    public readonly port: number;

    //Express Server
    private _expressApp: Express;
    private _expressRouter: Router;
    private _httpServer: HttpServer;

    //Controllers
    private readonly _controllers: Array<{controler: typeof Controller, route: RouteOptions}>;

    constructor(baseUrl?: string){
        //Call super for EventEmitter.
        super();

        //Init Server variables.
        this.baseUrl = baseUrl || '/' + global.service.name.toLowerCase();
        this.port = Number(process.env.EXPRESS_PORT) || Defaults.EXPRESS_PORT;

        //Setup Express
        this._expressApp = express();
        this._expressApp.use(cors());
        this._expressApp.options('*', cors());
        this._expressApp.use(express.json());
        this._expressApp.use(express.urlencoded({extended: false}));

        //Setup proxy pass.
        this._expressApp.use((request: Request, response: Response, next: NextFunction) => {
            //Generate Proxy object from headers.
            Utility.generateProxyObjects(request);
            next();
        });

        //Setup Router
        this._expressRouter = express.Router();
        this._expressApp.use(this.baseUrl, this._expressRouter);

        // Error handler for 404
        this._expressApp.use((request: Request, response: Response, next: NextFunction) => {
            next(createError(404));
        });

        // Default error handler
        this._expressApp.use((error: any, request: Request, response: Response, next: NextFunction) => {
            response.locals.message = error.message;
            response.locals.error = request.app.get('env') === 'development' ? error : {};
            response.status(error.status || 500).send(error.message);
        });

        //Init Variables.
        this._controllers = new Array();
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public initController(controller: any){
        const _controller: typeof Controller = new controller();
        this._controllers.push({controler: _controller, route: undefined});
    }

    public addRoute(method: RouteMethod, path: PathParams, rootPath: boolean, handler: RequestHandler, controller: typeof Controller){
        if(!rootPath){
            const controllerName = controller.constructor.name.replace('Controller', '').toLowerCase();
            path = ('/' + controllerName + path);
        }

        //DO: Add to array.
        switch(method){
            case 'get':
                this.get(path, handler);
                break;
            case 'post':
                this.post(path, handler);
                break;
            case 'put':
                this.put(path, handler);
                break;
            case 'delete':
                this.delete(path, handler);
                break;
        }
    }

    /////////////////////////
    ///////Start/Stop Functions
    /////////////////////////
    public listen() {
        return new Promise<boolean>((resolve, reject) => {
            this._httpServer = this._expressApp.listen(this.port, () => {
                this.emit(Events.WWW_STARTED, this);
                resolve(true);
            });
        });
    }
    
    public close() {
        return new Promise<boolean>((resolve, reject) => {
            this._httpServer.close(() => {
                this.emit(Events.WWW_STOPPED, this);
                resolve(true);
            });
        });
    }

    /////////////////////////
    ///////Report
    /////////////////////////
    public getReport(){
        //Get all routes
        let serviceRoutes = new Array();
        this._expressRouter.stack.forEach(item => {
            serviceRoutes.push({
                name: item.route.stack[0].name,
                method: item.route.stack[0].method,
                path: this.baseUrl + item.route.path
            });
        });

        //Get all controllers
        let controllers = new Array();
        // this._controllers.forEach(controller => {
        //     let routes = new Array();

        //     controller.routes.forEach(route => {
        //         let _route = {
        //             name: route.name,
        //             method: route.method,
        //             path: this.baseUrl + route.path
        //         }
        //         routes.push(_route);

        //         //Remove controller routes from serviceRoutes.
        //         serviceRoutes.splice(serviceRoutes.findIndex(sRoute => JSON.stringify(sRoute) === JSON.stringify(_route)), 1);
        //     });
        //     controllers.push({[controller.constructor.name]: routes});
        // });

        return {
            serviceRoutes: serviceRoutes,
            controllers: controllers
        }
    }

    /////////////////////////
    ///////Router Functions
    /////////////////////////
    public all(path: PathParams, ...handlers: RequestHandler[]){
        this._expressRouter.all(path, ...handlers);
    }

    public get(path: PathParams, ...handlers: RequestHandler[]){
        this._expressRouter.get(path, ...handlers);
    }

    public post(path: PathParams, ...handlers: RequestHandler[]){
        this._expressRouter.post(path, ...handlers);
    }

    public put(path: PathParams, ...handlers: RequestHandler[]){
        this._expressRouter.put(path, ...handlers);
    }

    public delete(path: PathParams, ...handlers: RequestHandler[]){
        this._expressRouter.delete(path, ...handlers);
    }
}