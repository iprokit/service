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

//Local Imports
import FileUtility from './file.utility';
import DockerUtility from './docker.utility';
import Controller, { Endpoint } from './controller';
import RDSConnection, { InvalidRDSOptions, RDSConnectionInitOptions, RDSConnectionOptions } from './db.rds.connection';

//Types: MicroServiceInitOptions
export type MicroServiceInitOptions = {
    rds?: RDSConnectionInitOptions,
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
    ip: string,
    projectPath: string,
    rds?: RDSConnectionOptions
}

export default class MicroService {
    //Init variables.
    private projectPath = path.dirname(require.main.filename);

    //Server variables.
    private options: MicroServiceOptions;
    private app = express();
    private router = express.Router();

    //objects.
    private rds: RDSConnection = new RDSConnection();
    private controllers = new Array<typeof Controller>();

    //Default Constructor
    public constructor(options?: MicroServiceInitOptions) {
        const defaultOptions = options || {};

        //Load options
        this.loadDotEnvFile();
        this.loadServiceOptions();

        //Load express and router
        this.initExpressServer();

        this.init();//Load any user functions

        //Load RDS
        if(defaultOptions.rds !== undefined){
            this.initRDB(defaultOptions.rds);

            //Create RDS Endpoints
            this.createRDSEndpoints();
        }

        //Create Endpoints
        this.createHealthEndpoints();
        this.createReportEndpoints();

        //Inject Controllers
        if(defaultOptions.autoInjectControllers !== undefined){
            this.autoInjectControllers(defaultOptions.autoInjectControllers);
        }
        this.injectEndpoints();//Load any user controllers

        //Connect to DB's
        if(this.options.rds !== undefined){
            this.connectToRDS();//TODO: Bug here. Handle Promise
        }

        //Start the server
        this.startService();
    }

    /////////////////////////
    ///////User Functions
    /////////////////////////
    public init(){}

    public injectEndpoints(){}

    /////////////////////////
    ///////Get/Sets Functions
    /////////////////////////
    public getControllers(){
        return this.controllers;
    }

    /////////////////////////
    ///////Load Functions
    /////////////////////////
    private loadDotEnvFile(){
        const envPath = path.join(this.projectPath, '.env');

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
            ip: DockerUtility.getContainerIP(),
            projectPath: this.projectPath
        };
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

    /////////////////////////
    ///////DB Functions
    /////////////////////////
    private initRDB(rdsOptions: RDSConnectionInitOptions){
        try{
            //Init sequelize
            this.rds.init(this.options.name, this.options.projectPath, rdsOptions);

            //Get db options and load to service options.
            this.options.rds = this.rds.getOptions();
        }catch(error){
            if(error instanceof InvalidRDSOptions){
                console.log(error.message);
            }else{
                console.error(error);
            }
            console.log('Will continue...');
        }
    }

    private connectToRDS(){
        this.rds.connect()
            .then((dbOptions: any) => {
                console.log('Connected to %s://%s/%s', dbOptions.dialect, dbOptions.host, dbOptions.name);
            })
            .catch((error: any) => {
                if(error instanceof InvalidRDSOptions){
                    console.log(error.message);
                }else{
                    console.error(error);
                }
                console.log('Will continue...');
            });
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
            const controllerFiles = FileUtility.getFilePaths(this.options.projectPath + path, likeName, excludes);
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
        //Start server
        const server = this.app.listen(this.options.port, () => {
            console.log('Environment: %s', this.options.environment);
            console.log('%s micro service running on %s:%s', this.options.name, this.options.ip, this.options.port);
            console.log('%s : %o', this.options.name, {id: this.options.id, version: this.options.version});

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
        server.close(() => {
            if(this.rds.isConnected()){
                this.rds.disconnect()
                    .then((dbOptions: any) => {
                        console.log('Disconnected from %s://%s/%s', dbOptions.dialect, dbOptions.host, dbOptions.name);
                    })
                    .catch((error: any) => {
                        console.error(error);
                        console.log('Will continue...');
                    });
            }
            console.log('%s micro service shutdown complete.', this.options.name);
            process.exit(0);
        });
    }

    /////////////////////////
    ///////Endpoints Functions
    /////////////////////////
    private createHealthEndpoints() {
        this.get('/health', (request: Request, response: Response) => {
            try {
                response.status(httpStatus.OK).send({status: true});
            } catch (error) {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
            }
        });
    }

    private createReportEndpoints(){
        //Sudo objects to pass into promise. As this keyword is not available.
        let _router = this.router;
        let _options = this.options;

        let _models = this.rds.getModels();
        let _controllers = this.getControllers();

        this.get('/report', (request: Request, response: Response) => {
            try {
                const routesArray = new Array<{method: string, url: string}>();
                const baseURL = request.baseUrl;

                //Getting all registered routes from router.
                _router.stack.forEach((item) => {
                    const method = item.route.stack[0].method;
                    const url = baseURL + item.route.path;
                    routesArray.push({method, url});
                });

                const models = new Array<string>();
                const controllers = new Array<string>();

                if(_models !== undefined){
                    _models.forEach(model => {
                        models.push(model.name)
                    });
                }

                if(_controllers !== undefined){
                    _controllers.forEach(controller => {
                        controllers.push(controller.name);
                    });
                }

                const data = {
                    service: _options,
                    routes: routesArray,
                    models: models,
                    controllers: controllers,
                };

                response.status(httpStatus.OK).send({status: true, data});
            } catch (error) {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
            }
        });
    }

    private createRDSEndpoints(){
        //Sudo objects to pass into promise. As this keyword is not available.
        const rds = this.rds;

        this.post('/database/sync', (request: Request, response: Response) => {
            rds.sync(request.body.force)
                .then(() => {
                    response.status(httpStatus.OK).send({status: true, message: 'Database & tables synced!'});
                })
                .catch((error: any) => {
                    response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
                });
        });
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