//Import modules
import express, { Request, Response, NextFunction } from 'express';
import { PathParams, RequestHandlerParams } from 'express-serve-static-core';
import { Server } from 'http';
import cors from 'cors';
import httpStatus from 'http-status-codes';
import createError from 'http-errors';
import uuid from 'uuid/v1';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

//Adding project path to global before calling local imports.
global.projectPath = path.dirname(require.main.filename);

//Local Imports
import FileUtility from './file.utility';
import DockerUtility from './docker.utility';
import Controller from './controller';
import DBManager, {DBInitOptions, InvalidConnectionOptions} from './db.manager';

declare global {
    namespace NodeJS {
        interface Global {
            service: {
                id: string,
                name: string,
                version: string,
                environment: string
            }
            projectPath: string
        }
    }
}

//Types: MicroServiceInitOptions
export type MicroServiceInitOptions = {
    db?: DBInitOptions,
    autoInjectControllers?: AutoInjectControllerOptions
}

//Types: AutoInjectControllerOptions
export type AutoInjectControllerOptions = {
    paths?: Array<string>,
    likeName?: string,
    excludes?: Array<string>
};

//Types: MicroServiceOptions
export type MicroServiceOptions = {
    id: string,
    name: string,
    version: string,
    port: string | number,
    environment: string,
    ip: string
}

//Types: Endpoint
export type Endpoint = {
    method: 'get' | 'post' | 'put' | 'delete',
    url: PathParams,
    fn: RequestHandlerParams
}

export default class MicroService {
    //Server variables
    private app = express();
    private router = express.Router();

    //Types
    private options: MicroServiceOptions;

    //Objects
    private dbManager: DBManager;
    public readonly controllers: Array<typeof Controller>;

    //Default Constructor
    public constructor(options?: MicroServiceInitOptions) {
        //Load options from constructor
        options = options || {};

        //Load options
        this.loadDotEnvFile();
        this.loadServiceOptions();
        this.loadGlobalOptions();
        
        //Load objects
        this.dbManager = new DBManager();
        this.controllers = new Array<typeof Controller>();

        //Load express and router
        this.initExpressServer();

        //Create Endpoints
        this.mapServiceEndpoints();

        this.init();//Load any user functions

        //Load DB
        if(options.db !== undefined){
            this.initDB(options.db);
        }

        //Inject Controllers
        if(options.autoInjectControllers !== undefined){
            this.autoInjectControllers(options.autoInjectControllers);
        }
        this.injectEndpoints();//Load any user controllers

        //Start the server
        this.startService();
    }

    /////////////////////////
    ///////User Functions
    /////////////////////////
    public init(){}

    public injectEndpoints(){}

    /////////////////////////
    ///////Load Functions
    /////////////////////////
    private loadDotEnvFile(){
        //Getting env file.
        const envPath = path.join(global.projectPath, '.env');
        if(fs.existsSync(envPath)){
            dotenv.config({path: envPath});
        }
    }

    private loadServiceOptions(){
        //Try loading options from package.json and process.env
        this.options = {
            id: uuid(),
            name: process.env.npm_package_name || this.constructor.name.replace('App', ''),
            version: process.env.npm_package_version || '1.0.0',
            port: process.env.NODE_PORT || 3000,
            environment: process.env.NODE_ENV || 'production',
            ip: DockerUtility.getContainerIP()
        };
    }

    private loadGlobalOptions(){
        //Adding service variables to global.
        global.service = {
            id: this.options.id,
            name: this.options.name,
            version: this.options.version,
            environment: this.options.environment
        }
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    private initExpressServer() {
        //Setup Express
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({extended: false}));
        //TODO: Add logging.

        const url = ('/' + this.options.name).toLowerCase();
        this.app.use(url, this.router);

        // Error handler for 404
        this.app.use((request: Request, response: Response, next: NextFunction) => {
            next(createError(404));
        });

        // Default error handler
        this.app.use((error: any, request: Request, response: Response, next: NextFunction) => {
            response.locals.message = error.message;
            response.locals.error = request.app.get('env') === 'development' ? error : {};
            response.status(error.status || 500).send(error.message);
        });
    }

    private initDB(dbOptions: DBInitOptions){
        try{
            //Init sequelize
            this.dbManager.init(dbOptions);
            this.dbManager.endpoints.forEach((endpoint) => {
                this.createEndpoint(endpoint);
            });
        }catch(error){
            if(error instanceof InvalidConnectionOptions){
                console.log(error.message);
            }else{
                console.error(error);
            }
            console.log('Will continue...');
        }
    }

    /////////////////////////
    ///////Controller Functions
    /////////////////////////
    private autoInjectControllers(autoWireOptions: AutoInjectControllerOptions){
        const paths = autoWireOptions.paths || ['/'];
        const likeName = autoWireOptions.likeName || 'controller.js';
        const excludes = autoWireOptions.excludes || [];

        //Adding files to Exclude.
        excludes.push('/node_modules');

        paths.forEach((path: string) => {
            const controllerFiles = FileUtility.getFilePaths(path, likeName, excludes);
            controllerFiles.forEach(controllerFile => {
                const controller: typeof Controller = require(controllerFile).default;

                //Logging the controller before
                console.log('Adding endpoints from controller: %s', controller.name);

                //Getting all endpoints and merging them
                const endpoints = new Array<Endpoint>();
                Array.prototype.push.apply(endpoints, controller.mapDefaultEndpoints());
                Array.prototype.push.apply(endpoints, controller.mapCustomEndpoints());

                endpoints.forEach(endpoint => {
                    //Try creating endpoints
                    try{
                        //Adding base URL before creating endpoint.
                        endpoint.url = controller.baseURL().toString() + endpoint.url.toString();
                        this.createEndpoint(endpoint);
                    }catch(error){
                        console.error('Could not auto inject endpoint: %o in %s', endpoint, controller.name);
                    }
                });

                //Add to Array
                this.controllers.push(controller);
            });
        });
    }

    /////////////////////////
    ///////Service Functions
    /////////////////////////
    private startService() {
        console.log('Starting micro service...');
        //Connect to DB.
        this.dbManager.connect()
            .then((dbOptions: any) => {
                console.log('Connected to %s://%s/%s', dbOptions.type, dbOptions.host, dbOptions.name);
            })
            .catch((error) => {
                if(error instanceof InvalidConnectionOptions){
                    console.log(error.message);
                }else{
                    console.error(error);
                }
                console.log('Will continue...');
            }).finally(() => {
                //Starting server here.
                this.startListening();
            });
    }

    private startListening(){
        //Start server
        const server = this.app.listen(this.options.port, () => {
            const options = {
                id: this.options.id,
                version: this.options.version,
                environment: this.options.environment
            }
            console.log('%s : %o', this.options.name, options);
            console.log('%s micro service running on %s:%s', this.options.name, this.options.ip, this.options.port);

            //Adding process listeners to stop server gracefully.
            process.on('SIGTERM', () => {
                console.log('Recived SIGTERM!');
                this.stopService(server)
            });
    
            process.on('SIGINT', () => {
                console.log('Recived SIGINT!');
                this.stopService(server);
            });
        });
    }

    private stopService(server: Server){
        //Disconnection from DB.
        this.dbManager.disconnect()
            .then((dbOptions: any) => {
                console.log('Disconnected from %s://%s/%s', dbOptions.type, dbOptions.host, dbOptions.name);
            })
            .catch((error: any) => {
                console.error(error);
                console.log('Will continue...');
            });

        server.close(() => {
            console.log('%s micro service shutdown complete.', this.options.name);
            process.exit(0);
        });
    }

    /////////////////////////
    ///////Endpoints Functions
    /////////////////////////
    private mapServiceEndpoints(){
        //Adding endpoints.
        this.createEndpoint({method: 'get', url: '/health', fn: getHealth});
        this.createEndpoint({method: 'get', url: '/report', fn: getReport});

        //Sudo objects to pass into promise. As this keyword is not available.
        const _router = this.router;
        const _options = this.options;
        const _controllers = this.controllers;

        //Endpoint functions.
        function getHealth(request: Request, response: Response) {
            response.status(httpStatus.OK).send({status: true});
        }

        function getReport(request: Request, response: Response){
            try {
                const routesArray = new Array<{method: string, url: string}>();
                const baseURL = request.baseUrl;

                //Getting all registered routes from router.
                _router.stack.forEach((item: any) => {
                    const method = item.route.stack[0].method;
                    const url = baseURL + item.route.path;
                    routesArray.push({method, url});
                });

                const controllers = new Array<string>();

                if(_controllers !== undefined){
                    _controllers.forEach((controller: Controller) => {
                        controllers.push(controller.name);
                    });
                }

                const data = {
                    service: _options,
                    routes: routesArray,
                    controllers: controllers,
                };

                response.status(httpStatus.OK).send({status: true, data});
            } catch (error) {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
            }
        }
    }

    private createEndpoint(endpoint: Endpoint){
        switch(endpoint.method){
            case 'get':
                this.get(endpoint.url, endpoint.fn);
                break;
            case 'post':
                this.post(endpoint.url, endpoint.fn);
                break;
            case 'put':
                this.put(endpoint.url, endpoint.fn);
                break;
            case 'delete':
                this.delete(endpoint.url, endpoint.fn);
                break;
        }
    }

    /////////////////////////
    ///////Router Functions
    /////////////////////////
    public get(path: PathParams, ...handlers: RequestHandlerParams[]) {
        this.router.get(path, ...handlers);
    }

    public post(path: PathParams, ...handlers: RequestHandlerParams[]) {
        this.router.post(path, ...handlers);
    }

    public put(path: PathParams, ...handlers: RequestHandlerParams[]) {
        this.router.put(path, ...handlers);
    }

    public delete(path: PathParams, ...handlers: RequestHandlerParams[]) {
        this.router.delete(path, ...handlers);
    }
}