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
import DBManager, {DBInitOptions, InvalidConnectionOptionsError} from './db.manager';

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
    autoInjectControllers?: AutoInjectControllersOptions
}

//Types: AutoInjectControllersOptions
export type AutoInjectControllersOptions = {
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

//Server variables
const expressApp = express();
const expressRouter = express.Router();

//Alternative for this.
var that: MicroService;

export default class MicroService {
    //Types
    private options: MicroServiceOptions;

    //Objects
    private dbManager: DBManager;
    public readonly controllers: Array<typeof Controller>;

    //Default Constructor
    public constructor(options?: MicroServiceInitOptions) {
        //Setting that as this.
        that = this

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

        //Create App Endpoints
        new AppController();

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
    ///////Gets/Sets
    /////////////////////////
    public getOptions(){
        return this.options;
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
        expressApp.use(cors());
        expressApp.use(express.json());
        expressApp.use(express.urlencoded({extended: false}));
        //TODO: Add logging.

        expressApp.use(expressRouter);

        // Error handler for 404
        expressApp.use((request: Request, response: Response, next: NextFunction) => {
            next(createError(404));
        });

        // Default error handler
        expressApp.use((error: any, request: Request, response: Response, next: NextFunction) => {
            response.locals.message = error.message;
            response.locals.error = request.app.get('env') === 'development' ? error : {};
            response.status(error.status || 500).send(error.message);
        });
    }

    private initDB(dbOptions: DBInitOptions){
        try{
            //Init sequelize
            this.dbManager.init(dbOptions);
        }catch(error){
            if(error instanceof InvalidConnectionOptionsError){
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
    private autoInjectControllers(autoInjectOptions: AutoInjectControllersOptions){
        const paths = autoInjectOptions.paths || ['/'];
        const likeName = autoInjectOptions.likeName || 'controller.js';
        const excludes = autoInjectOptions.excludes || [];

        //Adding files to Exclude.
        excludes.push('/node_modules');

        paths.forEach((path: string) => {
            const controllerPaths = FileUtility.getFilePaths(path, likeName, excludes);
            controllerPaths.forEach(controllerPath => {
                const Controller = require(controllerPath).default;
                const controller = new Controller();

                //Logging the controller before
                console.log('Adding endpoints from controller: %s', controller.constructor.name);

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
                if(dbOptions !== undefined){
                    console.log('Connected to %s://%s/%s', dbOptions.type, dbOptions.host, dbOptions.name);
                }
            })
            .catch((error) => {
                if(error instanceof InvalidConnectionOptionsError){
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
        const server = expressApp.listen(this.options.port, () => {
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
                if(dbOptions !== undefined){
                    console.log('Disconnected from %s://%s/%s', dbOptions.type, dbOptions.host, dbOptions.name);
                }
            })
            .catch((error: any) => {
                console.error(error);
                console.log('Will continue...');
            }).finally(() => {
                //Stop Server
                server.close(() => {
                    console.log('%s micro service shutdown complete.', this.options.name);
                    process.exit(0);
                });
            });
    }
}

/////////////////////////
///////Router Decorators
/////////////////////////
export function Get(path: PathParams) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const url = getURL(path, target);
        expressRouter.get(url, descriptor.value);
    }
}

export function Post(path: PathParams) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const url = getURL(path, target);
        expressRouter.post(url, descriptor.value);
    }
}

export function Put(path: PathParams) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const url = getURL(path, target);
        expressRouter.put(url, descriptor.value);
    }
}

export function Delete(path: PathParams) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const url = getURL(path, target);
        expressRouter.delete(url, descriptor.value);
    }
}

function getURL(path: PathParams, target: any){
    if(target instanceof Controller){
        const controllerName = target.constructor.name.replace('Controller', '').toLowerCase();
        return ('/' + controllerName + path);
    }else{
        return path;
    }
}

/////////////////////////
///////App Controller
/////////////////////////
class AppController{
    @Get('/health')
    public getHealth(request: Request, response: Response) {
        response.status(httpStatus.OK).send({status: true});
    }

    @Get('/report')
    public getReport(request: Request, response: Response){
        try {
            const baseURL = request.baseUrl;
            const routes = new Array<{method: string, url: string}>();

            //Getting all registered routes from router.
            expressRouter.stack.forEach((item: any) => {
                const method = item.route.stack[0].method;
                const url = baseURL + item.route.path;
                routes.push({method, url});
            });

            const _controllers = that.controllers;
            const controllers = new Array<string>();

            if(_controllers !== undefined){
                _controllers.forEach((controller) => {
                    controllers.push(controller.constructor.name);
                });
            }

            const data = {
                service: that.getOptions(),
                routes: routes,
                controllers: controllers,
            };

            response.status(httpStatus.OK).send({status: true, data});
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
        }
    }
}