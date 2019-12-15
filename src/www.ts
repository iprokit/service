//Import modules
import Promise from 'bluebird';
import express, { Express, Router, Request, Response, NextFunction } from 'express';
import { PathParams, RequestHandler } from 'express-serve-static-core';
import { Server } from 'http';
import cors from 'cors';
import createError from 'http-errors';

//Local Imports
import { ServerComponent, Defaults } from './microservice';
import Utility from './utility';
import Controller from './controller';

//Types: RouteOptions
export type RouteMethod = 'get' | 'post' | 'put' | 'delete';
export type RouteOptions = {
    name: string,
    method: RouteMethod,
    path: PathParams
}

export default class WWW implements ServerComponent {
    //Server Variables.
    public readonly baseUrl: string;
    public readonly port: number;

    //Express Server
    private _expressApp: Express;
    private _expressRouter: Router;
    private _server: Server;

    //Controllers
    private readonly _controllers: Array<{controler: typeof Controller, route: RouteOptions}>;

    constructor(baseUrl: string, port?: number){
        //Init Server variables.
        this.baseUrl = baseUrl;
        this.port = port || Defaults.EXPRESS_PORT;

        //Init Express
        this._expressApp = express();
        this._expressRouter = express.Router();

        //Init Variables.
        this._controllers = new Array();

        this.initExpress();
    }

    /////////////////////////
    ///////Init Functions
    /////////////////////////
    private initExpress(){
        //Setup Express
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
    }

    public initController(controller: any){
        const _controller: typeof Controller = new controller();
        this._controllers.push({controler: _controller, route: undefined});
    }

    /////////////////////////
    ///////Start/Stop Functions
    /////////////////////////
    public listen() {
        return new Promise<boolean>((resolve, reject) => {
            this._server = this._expressApp.listen(this.port, () => {
                resolve(true);
            });
        });
    }
    
    public close() {
        return new Promise<boolean>((resolve, reject) => {
            this._server.close(() => {
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
            init: {
                baseUrl: this.baseUrl,
                port: this.port
            },
            serviceRoutes: serviceRoutes,
            controllers: controllers
        }
    }

    /////////////////////////
    ///////Router Functions
    /////////////////////////
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