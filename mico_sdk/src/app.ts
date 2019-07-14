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
import SequelizeConnection, { InvalidSequelizeOptions } from './sequelize.connection';
import Controller from './controller';

export default class MicroService {
    //Server variables.
    private options: any;
    private app = express();
    private router = express.Router();

    //Sequelize variables.
    private sequelize: SequelizeConnection = new SequelizeConnection();

    //Default Constructor
    public constructor() {
        //Load options
        this.loadDotEnvFile();
        this.loadServiceOptions();

        //Load express and router
        this.initExpressServer();

        //Load Databases
        this.initSequelize();
        //TODO: Add Mongoose Connection.

        //Create Endpoints
        this.createHealthEndpoints();
        this.createReportEndpoints();
        this.createDBEndpoints();

        //Loading any user level objects
        this.init();

        //Start the server & DB connections
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
    public init(){}//User init

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

    private initSequelize(){
        //Try loading sequelize DB
        if(this.sequelize.hasOptions()){
            try{
                this.sequelize.init(this.options.name);
                this.options.db = this.sequelize.getOptions();
            }catch(error){
                if(error instanceof InvalidSequelizeOptions){
                    console.log(error.message);
                }else{
                    console.error(error);
                }
                console.log('Will continue...');
            }
        }else{
            console.log('No sequelize options were provided.');
            console.log('Will continue...')
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

            //Starting database connection.
            if(this.sequelize.isReady()){
                this.sequelize.connect()
                .then((dbOptions: any) => {
                    console.log('Connected to %s://%s/%s', dbOptions.dialect, dbOptions.host, dbOptions.name);
                })
                .catch((error: any) => {
                    if(error instanceof InvalidSequelizeOptions){
                        console.log(error.message);
                    }else{
                        console.error(error);
                    }
                    console.log('Will continue...');
                });
            }
        });
    }

    private stopService(server: Server){
        server.close(() => {
            if(this.sequelize.isConnected()){
                this.sequelize.disconnect()
                .then((dbOptions: any) => {
                    console.log('Disconnected from %s://%s/%s', dbOptions.dialect, dbOptions.host, dbOptions.name);
                })
                .catch((error: any) => {
                    console.error(error);
                    console.log('Will continue...');
                });
            }
            console.log('Micro service %s shutdown complete.', this.options.name);
            process.exit(0);
        });
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
                console.log(error);
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
            }
        });
    }

    private createDBEndpoints(){
        //Sudo objects to pass into promise. As this keyword is not available.
        const sequelize = this.sequelize;

        if(sequelize.isReady()){
            this.post('/database/sync', (request: Request, response: Response) => {
                try {
                    sequelize.sync(request.body.force)
                    .then(() => {
                        response.status(httpStatus.OK).send({status: true, message: 'Database & tables synced!'});
                    })
                    .catch((error: any) => {
                        response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
                    });
                } catch (error) {
                    response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
                }
            });
        }
    }

    public createDefaultEndpoints(controller: Controller) {
        //Try setting up the sequelize model.
        if(this.sequelize.isReady()){
            const model = controller.model;
            this.sequelize.initModel(model);

            //Logging the model loaded.
            console.log('%s: Mapped to connection.', model.name);
        }
        
        //Getting URL from controller name and Setting up routes.
        const baseURL = '/' + controller.name.replace('Controller', '').toLowerCase();

        //Setting up routes
        this.get(baseURL + '/:id', controller.selectOneByID);
        this.get(baseURL, controller.selectAll);
        this.get(baseURL + "/orderby/new", controller.selectAllAndOrderByCreatedAt);
        this.post(baseURL, controller.add);
        this.put(baseURL, controller.update);
        this.delete(baseURL + '/:id', controller.deleteOneByID);

        //Logging the controller loaded.
        console.log('%s: Default endpoints added.', controller.name);
    }
}