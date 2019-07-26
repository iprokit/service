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
import DockerUtility from './docker.utility';
import Controller from './controller';
import RDSModel from './db.rds.model';
import RDSConnection, { InvalidRDSOptions } from './db.rds.connection';

export default class MicroService {
    //Server variables.
    private options: any;
    private app = express();
    private router = express.Router();

    //DB variables.
    private rds: RDSConnection = new RDSConnection();

    //Default Constructor
    public constructor() {
        //Load options
        this.loadDotEnvFile();
        this.loadServiceOptions();

        //Load express and router
        this.initExpressServer();

        //Load Models
        this.initModels();

        //Load Databases
        this.initRDS();
        this.connectToDatabases();//Bug here. Handle Promise

        //Create Endpoints
        this.createHealthEndpoints();
        this.createReportEndpoints();
        this.createDBEndpoints();

        //Load Default Endpoints from user Controllers
        this.initControllers();

        //Start the server
        this.startService();
    }

    /////////////////////////
    ///////Load Functions
    /////////////////////////
    private loadDotEnvFile(){
        const envPath = path.dirname(require.main.filename) + '/.env';
        if(fs.existsSync(envPath)){
            dotenv.config({path: envPath});
        }
    }

    private loadServiceOptions(){
        //Try loading options from package.json and process.env
        this.options = {
            id: uuid(),
            name: process.env.npm_package_name,
            version: process.env.npm_package_version,
            type: process.env.npm_package_type,
            port: process.env.NODE_PORT,
            environment: process.env.NODE_ENV,
            ip: DockerUtility.getContainerIP()
        };

        //Loading default options
        this.options.name = this.options.name !== undefined ? this.options.name: this.constructor.name.replace('App', '');
        this.options.version = this.options.version !== undefined ? this.options.version: '1.0.0';
        this.options.type = this.options.type !== undefined ? this.options.type: 'API';
        this.options.port = this.options.port !== undefined ? this.options.port: 3000;
        this.options.environment = this.options.environment !== undefined ? this.options.environment: 'production';
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public initModels(){}
    public initControllers(){}

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
    private initRDS(){
        //Try loading RDS
        if(this.rds.hasOptions()){
            try{
                this.rds.init(this.options.name);
                this.options.db = this.rds.getOptions();
            }catch(error){
                if(error instanceof InvalidRDSOptions){
                    console.log(error.message);
                }else{
                    console.error(error);
                }
                console.log('Will continue...');
            }
        }else{
            console.log('No RDB options were provided.');
            console.log('Will continue...')
        }
    }

    private connectToDatabases(){
        if(this.rds.isReady()){
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
    }

    /////////////////////////
    ///////Service Functions
    /////////////////////////
    private startService() {
        // Start server
        const server = this.app.listen(this.options.port, () => {
            console.log('Environment: %s', this.options.environment);
            console.log('%s micro service running on %s:%s', this.options.name, this.options.ip, this.options.port);
            console.log('%s : %o', this.options.name, {
                id: this.options.id,
                version: this.options.version,
                type: this.options.type
            });

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
        const router = this.router;
        const options = this.options;

        this.get('/report', (request: Request, response: Response) => {
            try {
                const routesArray: any = [];
                const baseURL = request.baseUrl;

                //Getting all registered routes from router.
                router.stack.forEach((item) => {
                    const method = item.route.stack[0].method;
                    const url = baseURL + item.route.path;
                    routesArray.push({method, url});
                });

                const data = {
                    service: options,
                    routes: routesArray
                };

                response.status(httpStatus.OK).send({status: true, data});
            } catch (error) {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
            }
        });
    }

    private createDBEndpoints(){
        //Sudo objects to pass into promise. As this keyword is not available.
        const rds = this.rds;

        if(rds.isReady()){
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
    }

    public createDefaultEndpoints(controller: typeof Controller) {
        //Logging the controller before
        console.log('Adding default endpoints from controller: %s', controller.name);

        //Getting URL from controller name and Setting up routes.
        const baseURL = '/' + controller.name.replace('Controller', '').toLowerCase();

        //Setting up routes
        this.get(baseURL + '/:id', controller.getOneByID);
        this.get(baseURL, controller.getAll);
        this.get(baseURL + "/orderby/:orderType", controller.getAllOrderByCreatedAt);
        this.post(baseURL, controller.create);
        this.put(baseURL, controller.updateOneByID);
        this.delete(baseURL + '/:id', controller.deleteOneByID);
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

    /////////////////////////
    ///////DB Functions
    /////////////////////////
    public addRDSModel(model: typeof RDSModel){
        this.rds.addModel(model);
    }
}