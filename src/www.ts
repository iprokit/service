//Import modules
import { EventEmitter } from 'events';
import express, { Express, Router, Request, Response, NextFunction } from 'express';
import { PathParams, RequestHandler } from 'express-serve-static-core';
import { Server } from 'http';
import cors from 'cors';
import createError from 'http-errors';

//Local Imports
import { Component, Events, Defaults } from './microservice';
import Utility from './utility';
import Controller from './controller';

export default class WWW extends EventEmitter implements Component {
    //Server Variables.
    private baseUrl: string;
    private port: number;

    //Express Server
    private expressApp: Express;
    private expressRouter: Router;
    private server: Server;

    //Controllers
    private readonly controllers: Array<typeof Controller>;

    constructor(){
        //Call super for EventEmitter.
        super();

        //Init Server variables.
        this.port = Number(process.env.EXPRESS_PORT) || Defaults.EXPRESS_PORT;

        //Init Express
        this.expressApp = express();
        this.expressRouter = express.Router();

        //Init Variables.
        this.controllers = new Array();
    }

    /////////////////////////
    ///////Gets/Sets
    /////////////////////////
    public getReport(){
        //Get all routes
        let serviceRoutes = new Array();
        this.expressRouter.stack.forEach(item => {
            serviceRoutes.push({
                name: item.route.stack[0].name,
                method: item.route.stack[0].method,
                path: this.baseUrl + item.route.path
            });
        });

        //Get all controllers
        let controllers = new Array();
        this.controllers.forEach(controller => {
            let routes = new Array();

            controller.routes.forEach(route => {
                let _route = {
                    name: route.name,
                    method: route.method,
                    path: this.baseUrl + route.path
                }
                routes.push(_route);

                //Remove controller routes from serviceRoutes.
                serviceRoutes.splice(serviceRoutes.findIndex(sRoute => JSON.stringify(sRoute) === JSON.stringify(_route)), 1);
            });
            controllers.push({[controller.constructor.name]: routes});
        });

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
    ///////Init Functions
    /////////////////////////
    public init(baseUrl: string){
        this.baseUrl = baseUrl;

        //Setup Express
        this.expressApp.use(cors());
        this.expressApp.options('*', cors());
        this.expressApp.use(express.json());
        this.expressApp.use(express.urlencoded({extended: false}));

        //Setup proxy pass.
        this.expressApp.use((request: any, response: Response, next: NextFunction) => {
            //Generate Proxy object from headers.
            Utility.generateProxyObjects(request);
            next();
        });

        //Setup Router
        this.expressApp.use(this.baseUrl, this.expressRouter);

        // Error handler for 404
        this.expressApp.use((request: Request, response: Response, next: NextFunction) => {
            next(createError(404));
        });

        // Default error handler
        this.expressApp.use((error: any, request: Request, response: Response, next: NextFunction) => {
            response.locals.message = error.message;
            response.locals.error = request.app.get('env') === 'development' ? error : {};
            response.status(error.status || 500).send(error.message);
        });
    }

    public initController(controller: any){
        const _controller: typeof Controller = new controller();
        this.emit(Events.INIT_CONTROLLER, _controller.constructor.name, _controller);

        _controller.routes.forEach(route => {
            if(route.method === 'get'){
                this.expressRouter.get(route.path, route.fn);
            }else if(route.method === 'post'){
                this.expressRouter.post(route.path, route.fn);
            }else if(route.method === 'put'){
                this.expressRouter.put(route.path, route.fn);
            }else if(route.method === 'delete'){
                this.expressRouter.delete(route.path, route.fn);
            }
        });
        this.controllers.push(_controller);
    }

    /////////////////////////
    ///////Start/Stop Functions
    /////////////////////////
    public listen(){
        this.server = this.expressApp.listen(this.port, () => {
            this.emit(Events.WWW_STARTED, {port: this.port, baseUrl: this.baseUrl});
        });
    }

    public close(callback?: Function){
        this.server.close(() => {
            this.emit(Events.WWW_STOPPED);
            if(callback){
                callback();
            }
        });
    }

    /////////////////////////
    ///////Router Functions
    /////////////////////////
    public all(path: PathParams, ...handlers: RequestHandler[]){
        this.expressRouter.all(path, ...handlers);
    }

    public get(path: PathParams, ...handlers: RequestHandler[]){
        this.expressRouter.get(path, ...handlers);
    }

    public post(path: PathParams, ...handlers: RequestHandler[]){
        this.expressRouter.post(path, ...handlers);
    }

    public put(path: PathParams, ...handlers: RequestHandler[]){
        this.expressRouter.put(path, ...handlers);
    }

    public delete(path: PathParams, ...handlers: RequestHandler[]){
        this.expressRouter.delete(path, ...handlers);
    }
}