//Import modules
import express, { Request, Response, NextFunction } from 'express';
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
import CommBroker from './comm.broker';
import CommClient from './comm.client';
import CommPublisher from './comm.publisher';
import DBManager, {DBInitOptions, InvalidConnectionOptionsError} from './db.manager';

declare global {
    namespace NodeJS {
        interface Global {
            service: {
                id: string,
                name: string,
                version: string,
                expressPort: string | number,
                comPort: string | number,
                environment: string
            }
            projectPath: string
        }
    }
}

//Types: MicroServiceInitOptions
export type MicroServiceInitOptions = {
    db?: DBInitOptions,
    autoInjectControllers?: AutoInjectControllerOptions,
    mesh?: MeshOptions
}

//Types: AutoInjectControllerOptions
export type AutoInjectControllerOptions = {
    paths?: Array<string>,
    likeName?: string,
    excludes?: Array<string>
};

//Types: AutoInjectPublisherOptions
export type AutoInjectPublisherOptions = {
    paths?: Array<string>,
    likeName?: string,
    excludes?: Array<string>
};

export type MeshOptions = {
    autoInjectPublishers?: AutoInjectPublisherOptions,
    services: Array<string>
}

//Types: MicroServiceOptions
export type MicroServiceOptions = {
    id: string,
    name: string,
    version: string,
    expressPort: string | number,
    comPort: string | number,
    environment: string,
    ip: string
}

//Comm broker variables
export var commBroker = new CommBroker();

//Alternative for this.
var that: MicroService;

export function getMicroService(serviceName: string){
    return new Promise((resolve, reject) => {
        return that.commClients.find(client => client.name === serviceName);
    });
}

export default class MicroService {
    //Types
    private options: MicroServiceOptions;

    //Objects
    private dbManager: DBManager;
    public readonly controllers: Array<typeof Controller> = new Array<typeof Controller>();
    public readonly publishers: Array<typeof CommPublisher> = new Array<typeof CommPublisher>();
    public readonly commClients: Array<{name: string, client: CommClient}> = new Array<{name: string, client: CommClient}>();

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

        //Load express server, router
        this.initExpressServer();

        //Auto call, to create default/app endpoints.
        new MicroServiceController();

        this.init();//Load any user functions

        //Load DB
        if(options.db !== undefined){
            this.initDB(options.db);
        }

        //Map Mesh
        if(options.mesh !== undefined){
            this.autoInjectPublishers(options.mesh.autoInjectPublishers);
            this.mapMesh(options.mesh.services);
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
            expressPort: process.env.EXPRESS_PORT || 3000,
            comPort: process.env.COM_PORT || 1883,
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
            comPort: this.options.comPort,
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
    ///////Inject Functions
    /////////////////////////
    private autoInjectControllers(autoInjectOptions: AutoInjectControllerOptions){
        let paths = autoInjectOptions.paths || ['/'];
        const likeName = autoInjectOptions.likeName || 'controller.js';
        const excludes = autoInjectOptions.excludes || [];

        //Adding files to Exclude.
        excludes.push('/node_modules');

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
    
    private autoInjectPublishers(autoInjectOptions: AutoInjectPublisherOptions){
        let paths = autoInjectOptions.paths || ['/'];
        const likeName = autoInjectOptions.likeName || 'publisher.js';
        const excludes = autoInjectOptions.excludes || [];

        //Adding files to Exclude.
        excludes.push('/node_modules');

        paths.forEach((path: string) => {
            let publisherPaths = FileUtility.getFilePaths(path, likeName, excludes);
            publisherPaths.forEach(publisherPath => {
                const Publisher = require(publisherPath).default;
                const publisher = new Publisher();

                console.log('Mapping publishers: %s', publisher.constructor.name);

                //Add to Array
                this.publishers.push(publisher);
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
            console.log('Express server running on %s:%s', this.options.ip, this.options.expressPort);
        });
        this.addExpressListeners(server);

        //Start comm broker
        commBroker.listen(this.options.comPort)
            .then(() => {
                console.log('Comm broker running on %s:%s', this.options.ip, this.options.comPort);
            });

        //Get all comm clients
        this.commClients.forEach((commClient) => {
            const _commClient = commClient.client;
            //Connect to comm client
            _commClient.connect()
                .then((options: any) =>{
                    console.log('Comm client connected to %s', options.url);
                    _commClient.setup();
                });
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
        //Chained stopping all the servers and clients.
        //Close DB connection.
        this.dbManager.disconnect()
            .then((dbOptions: any) => {
                if(dbOptions !== undefined){
                    console.log('DB client disconnected from %s://%s/%s', dbOptions.type, dbOptions.host, dbOptions.name);
                }
            })
            .finally(() => {
                //Close Comm Client connections.
                this.commClients.forEach((commClient) => {
                    const _commClient = commClient.client;
                    _commClient.disconnect()
                        .then((options: any) =>{
                            console.log('Comm client disconnected from %s', options.url);
                        })
                        .finally(() => {
                            //Stop comm broker
                            commBroker.close()
                                .then(() => {
                                    console.log('Comm broker shutdown complete.');
                                })
                                .finally(() => {
                                    //Stop Server
                                    server.close(() => {
                                        console.log('Express server shutdown complete.');
                                        process.exit(0);
                                    });
                                });
                        });
                });
            });
    }

    /////////////////////////
    ///////Other Functions
    /////////////////////////
    private mapMesh(services: Array<string>){
        services.forEach(service => {
            //Creating comm client object.
            const commClient = new CommClient(service);

            console.log('Mapping mesh: %s', commClient.url);

            //Add to Array
            this.commClients.push({name: service, client: commClient});
        });
    }

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

            const _controllers = that.controllers;
            let controllers = new Array<string>();

            _controllers.forEach((controller) => {
                controllers.push(controller.constructor.name);
            });

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