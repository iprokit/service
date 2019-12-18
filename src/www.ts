//Import modules
import Promise from 'bluebird';
import { EventEmitter } from 'events';
import express, { Express, Router, Request, Response, NextFunction } from 'express';
import { PathParams, RequestHandler } from 'express-serve-static-core';
import { Server as HttpServer } from 'http';
import cors from 'cors';
import createError from 'http-errors';

//Export Libs
export { PathParams as WWWPathParams, RequestHandler as WWWHandler };

//Local Imports
import { Server, Events, Defaults } from './microservice';
import Utility from './utility';
import Controller from './controller';

//Types: RouteOptions
export type RouteMethod = 'get' | 'post' | 'put' | 'delete';

//Types: Route
export type Route = {
    method: RouteMethod,
    path: PathParams,
    handler: RequestHandler
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
    private readonly _controllerStack: Array<{controller: typeof Controller, routes: Array<Route>}>;
    private readonly _serviceRouteStack: Array<Route>;

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
        this._controllerStack = new Array();
        this._serviceRouteStack = new Array();
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public addControllerRoute(method: RouteMethod, path: PathParams, controller: typeof Controller, handler: RequestHandler){
        //Sub function to add Controller to _controllerStack
        const _addControllerStack = () => {
            //Create new routes.
            const routes = new Array({method: method, path: this.baseUrl + path, handler: handler});
    
            //Push Controller & routes to controllerStack.
            this._controllerStack.push({controller: controller, routes: routes});
        }

        //Validate if controllerStack is empty.
        if(this._controllerStack.length === 0){
            _addControllerStack();
        }else{
            //Find existing controllerStack.
            const controllerStack = this._controllerStack.find(stack => stack.controller.name === controller.name);

            if(controllerStack){    //controllerStack exists. 
                controllerStack.routes.push({method: method, path: this.baseUrl + path, handler: handler});
            }else{  //No controllerStack found.
                _addControllerStack();
            }
        }
    }

    private createServiceRouteStack(){
        //Get all routes from expressRouter.
        this._expressRouter.stack.forEach(item => {
            const expressRoute = {
                method: item.route.stack[0].method,
                path: this.baseUrl + item.route.path,
                handler: item.route.stack[0].handle
            }
            this._serviceRouteStack.push(expressRoute);
        });

        //Get all routes from controllerStack
        this._controllerStack.forEach(stack => {
            stack.routes.forEach(cRoute => {
                //Remove controller routes from serviceRoutes.
                this._serviceRouteStack.splice(this._serviceRouteStack.findIndex(sRoute => JSON.stringify(sRoute) === JSON.stringify(cRoute)), 1);
            });
        });
    }

    /////////////////////////
    ///////Start/Stop Functions
    /////////////////////////
    public listen() {
        this.createServiceRouteStack();

        return new Promise<boolean>((resolve, reject) => {
            this._httpServer = this._expressApp.listen(this.port, () => {
                this.emit(Events.WWW_STARTED, this);
                resolve(true);
            });
        });
    }
    
    public close() {
        return new Promise<boolean>((resolve, reject) => {
            this._httpServer.close((error) => {
                if(!error){
                    this.emit(Events.WWW_STOPPED, this);
                    resolve(true);
                }else{
                    reject(error);
                }
            });
        });
    }

    /////////////////////////
    ///////Report
    /////////////////////////
    public getReport(){
        //Sub function to create Routes.
        const _createRoutes = (routes: Array<Route>) => {
            let _routes = new Array();
            routes.forEach(route => {
                let method = (route.method === undefined) ? 'all' : route.method;
                _routes.push({
                    fn: route.handler.name,
                    [method.toUpperCase()]: route.path
                });
            });
            return _routes;
        }

        //New controllers
        let controllers: {[name: string]: Array<string>} = {};

        //Get stack from _controllerStack
        this._controllerStack.forEach(stack => {
            controllers[stack.controller.name] = _createRoutes(stack.routes);
        });

        return {
            serviceRoutes: _createRoutes(this._serviceRouteStack),
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