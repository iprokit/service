//Import modules
import express, { Request, Response, NextFunction } from 'express';
import { PathParams, RequestHandler } from 'express-serve-static-core';
import { Server } from 'http';
import cors from 'cors';
import httpStatus from 'http-status-codes';
import createError from 'http-errors';
import uuid from 'uuid/v1';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

//Adding project path to global.
global.projectPath = path.dirname(require.main.filename);

//Express server variables
var expressApp = express();
export var expressRouter = express.Router();

//Local Imports
import FileUtility from './file.utility';
import DockerUtility from './docker.utility';
import Controller from './controller';
import { Report } from './routes';
import CommBroker, { AutoInjectPublisherOptions } from './comm.broker';
import CommMesh from './comm.mesh';
import DBManager, {DBInitOptions, InvalidConnectionOptionsError} from './db.manager';

declare global {
    namespace NodeJS {
        interface Global {
            service: {
                id: string,
                name: string,
                version: string,
                expressPort: number,
                comBrokerPort: number,
                environment: string
            }
            projectPath: string
        }
    }
}

//Types: MicroServiceInitOptions
export type MicroServiceInitOptions = {
    name?: string,
    version?: string,
    url?: string,
    db?: DBInitOptions,
    autoInjectControllers?: AutoInjectControllerOptions,
    comm?: CommOptions
}

//Types: AutoInjectControllerOptions
export type AutoInjectControllerOptions = {
    paths?: Array<string>,
    likeName?: string,
    excludes?: Array<string>
};

//Types: CommOptions
export type CommOptions = {
    autoInjectPublishers?: AutoInjectPublisherOptions,
    mesh: Array<string>
}

//Types: MicroServiceOptions
export type MicroServiceOptions = {
    id: string,
    name: string,
    version: string,
    expressPort: number,
    comBrokerPort: number,
    environment: string,
    ip: string
}

//Comm broker and client objects
export var commBroker: CommBroker;

//Alternative for this.
var that: MicroService;

export default class MicroService {
    //Types
    private options: MicroServiceOptions;
    private initOptions: MicroServiceInitOptions;

    //DB Objects
    public readonly dbManager: DBManager;

    //Comm Objects
    public readonly commMesh: CommMesh;

    //Objects
    public readonly controllers: Array<typeof Controller> = new Array<typeof Controller>();

    //Default Constructor
    public constructor(options?: MicroServiceInitOptions) {
        //Setting that as this.
        that = this;

        //Load options from constructor
        this.initOptions = options || {};

        //Load options
        this.loadDotEnvFile();
        this.loadServiceOptions();
        this.loadGlobalOptions();

        //Load express server, router
        this.initExpressServer();

        //Auto call, to create default/app endpoints.
        new MicroServiceController();

        this.init();//Load any user functions

        //Load DB
        this.dbManager = new DBManager();
        if(this.initOptions.db !== undefined){
            this.initDB(this.initOptions.db);
        }

        //Load Comm
        commBroker = new CommBroker();
        this.commMesh = new CommMesh();
        if(this.initOptions.comm !== undefined){
            this.initComm(this.initOptions.comm);
        }

        //Inject Controllers
        if(this.initOptions.autoInjectControllers !== undefined){
            this.autoInjectControllers(this.initOptions.autoInjectControllers);
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
            name: this.initOptions.name || process.env.npm_package_name,
            version: this.initOptions.version || process.env.npm_package_version,
            expressPort: Number(process.env.EXPRESS_PORT) || 3000,
            comBrokerPort: Number(process.env.COM_BROKER_PORT) || 6000,
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
            expressPort: this.options.expressPort,
            comBrokerPort: this.options.comBrokerPort,
            environment: this.options.environment
        }
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    private initExpressServer() {
        //Setup Express
        expressApp.use(cors());
        expressApp.options('*', cors());
        expressApp.use(express.json());
        expressApp.use(express.urlencoded({extended: false}));
        //TODO: Add logging.

        this.initOptions.url = (this.initOptions.url || '/' + this.options.name).toLowerCase();
        expressApp.use(this.initOptions.url, expressRouter);

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

    private initComm(commOptions: CommOptions){
        commBroker.init({autoInjectPublishers: commOptions.autoInjectPublishers});
        this.commMesh.init({mesh: commOptions.mesh});
    }

    /////////////////////////
    ///////Inject Functions
    /////////////////////////
    private autoInjectControllers(autoInjectOptions: AutoInjectControllerOptions){
        let paths = autoInjectOptions.paths || ['/'];
        const likeName = autoInjectOptions.likeName || 'controller.js';
        const excludes = autoInjectOptions.excludes || [];

        paths.forEach((path: string) => {
            let controllerPaths = FileUtility.getFilePaths(path, likeName, excludes);
            controllerPaths.forEach(controllerPath => {
                const Controller = require(controllerPath).default;
                const controller = new Controller();

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
        const options = {
            id: this.options.id,
            version: this.options.version,
            environment: this.options.environment
        }
        console.log('%s : %o', this.options.name, options);
        console.log('Starting micro service...');

        //Parallel starting all the servers and clients.

        //Start express server
        const server = expressApp.listen(this.options.expressPort, () => {
            console.log('Express server running on %s:%s%s', this.options.ip, this.options.expressPort, this.initOptions.url);
        });
        this.addExpressListeners(server);

        //Start comm broker
        commBroker.listen()
            .then(() => {
                console.log('Comm broker broadcasting on %s:%s', this.options.ip, this.options.comBrokerPort);
            });

        //Connect comm Mesh
        this.commMesh.connect()
            .then((urls: []) => {
                console.log('Comm mesh connected to %o', urls);
            });

        //Connect to DB.
        this.dbManager.connect()
            .then((dbOptions: any) => {
                if(dbOptions !== undefined){
                    console.log('DB client connected to %s://%s/%s', dbOptions.type, dbOptions.host, dbOptions.name);
                }
            })
            .catch((error) => {
                if(error instanceof InvalidConnectionOptionsError){
                    console.log(error.message);
                }else{
                    console.error(error);
                }
                console.log('Will continue...');
            })
    }

    private stopService(server: Server){
        //Chained stopping all components.
        this.dbManager.disconnect()
            .then(() => {
                console.log('DB client disconnected.');
                this.commMesh.disconnect()
                    .then(() => {
                        console.log('Comm mesh disconnected.');
                        //Stop comm broker
                        commBroker.close()
                            .then(() => {
                                console.log('Comm broker shutdown complete.');
                                //Stop Server
                                server.close(() => {
                                    console.log('Express server shutdown complete.');
                                    process.exit(0);
                                });
                            });
                    });
            });
    }

    /////////////////////////
    ///////Other Functions
    /////////////////////////
    private addExpressListeners(server: Server){
        //Adding process listeners to stop server gracefully.
        process.on('SIGTERM', () => {
            console.log('Recived SIGTERM!');
            this.stopService(server)
        });

        process.on('SIGINT', () => {
            console.log('Recived SIGINT!');
            this.stopService(server);
        });
    }

    /////////////////////////
    ///////Router Functions
    /////////////////////////
    public all(path: PathParams, ...handlers: RequestHandler[]){
        expressRouter.all(path, ...handlers);
    }

    public get(path: PathParams, ...handlers: RequestHandler[]){
        expressRouter.get(path, ...handlers);
    }

    public post(path: PathParams, ...handlers: RequestHandler[]){
        expressRouter.post(path, ...handlers);
    }

    public put(path: PathParams, ...handlers: RequestHandler[]){
        expressRouter.put(path, ...handlers);
    }

    public delete(path: PathParams, ...handlers: RequestHandler[]){
        expressRouter.delete(path, ...handlers);
    }
}

/////////////////////////
///////Component
/////////////////////////
export interface Component {
    init(initOptions: any): void;
    getOptions(): any;
    getReport(): any;
}

/////////////////////////
///////MicroService Controller
/////////////////////////
class MicroServiceController {
    @Report('/health')
    public getHealth(request: Request, response: Response) {
        response.status(httpStatus.OK).send({status: true});
    }

    @Report('/report')
    public getReport(request: Request, response: Response){
        try {
            const baseURL = request.baseUrl;
            let routes = new Array<{method: string, url: string}>();

            //Getting all registered routes from router.
            expressRouter.stack.forEach((item: any) => {
                const method = item.route.stack[0].method;
                const url = baseURL + item.route.path;
                routes.push({method, url});
            });

            let controllers = new Array<string>();

            that.controllers.forEach((controller) => {
                controllers.push(controller.constructor.name);
            });

            const data = {
                service: that.getOptions(),
                db: that.dbManager.getReport(),
                commBroker: commBroker.getReport(),
                commMesh: that.commMesh.getReport(),
                controllers: controllers,
                routes: routes
            };

            response.status(httpStatus.OK).send({status: true, data});
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
        }
    }
}