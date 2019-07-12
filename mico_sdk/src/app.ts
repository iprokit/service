//Import modules
import express from 'express';
import { Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import cors from 'cors';
import httpStatus from 'http-status-codes';
import createError from 'http-errors';
import uuid from 'uuid/v1';
import { DataTypes } from 'sequelize';

//Local Imports
import DockerUtility from './docker.utility';
import SequelizeConnection from './sequelize.connection';
import Controller from './controller';
import SequelizeModel from './sequelize.model';

//Init variables
var app = express();
var router = express.Router();
var sequelizeConnection: SequelizeConnection;

//Export variables
export var serviceName: string;

class MicroService {
    options: any;
    sequelizeModels: Array<typeof SequelizeModel>;

    //Default Constructor
    constructor(options: any) {
        this.options = options;

        //First check if the name exists.
        if(this.options.name === undefined){
            throw new Error('Service name required');
        }
        serviceName = this.options.name;
        
        //Init service variables.
        this.options.id = uuid();
        this.options.version = this.options.version !== undefined ? this.options.version: '1.0';
        this.options.type = this.options.type !== undefined ? this.options.type: 'API';
        this.options.port = this.options.port !== undefined ? this.options.port: 3000;
        this.options.ip = DockerUtility.getContainerIP();

        //Load sequelize
        this.sequelizeModels = new Array<typeof SequelizeModel>();
        if (options.hasOwnProperty('mysql')) {
            options.mysql.dialect = 'mysql';
            sequelizeConnection = new SequelizeConnection(options.mysql);
        }

        //Load express and router
        this.initExpressServer();

        //Load Endpoints
        this.createDatabaseEndpoints();
        this.createHealthEndpoints();

        //TODO: Read dotenv from the project root.
    }

    initExpressServer() {
        //Setup Express
        app.use(cors());
        app.use(express.json());
        app.use(express.urlencoded({extended: false}));
        //TODO: Add logging.

        let url = ('/' + this.options.name).toLowerCase();
        app.use(url, router);

        // Error handler for 404
        app.use((request: Request, response: Response, next: NextFunction) => {
            next(createError(404));
        });

        // Default error handler
        app.use((error: any, request: Request, response: Response, next: NextFunction) => {
            response.locals.message = error.message;
            response.locals.error = request.app.get('env') === 'development' ? error : {};
            response.status(error.status || 500).send(error.message);
        });
    }

    startService() {
        //Call associate's from all the models
        this.sequelizeModels.forEach(sequelizeModel => {
            sequelizeModel.associate();
        });
        
        // Start server.
        let server = app.listen(this.options.port, () => {
            console.log('%s micro service running on %s:%s', this.options.name, this.options.ip, this.options.port);
            console.log('%s : %o', this.options.name, {
                id: this.options.id,
                version: this.options.version,
                type: this.options.type
            });

            //Starting database connection.
            sequelizeConnection.connect();
        });

        //Adding process listeners to stop server gracefully.
        this.addProcessListeners(server);
    }

    /////////////////////////
    ///////Router Functions
    /////////////////////////
    get(path: string, handlers: any) {
        router.get(path, handlers);
    }

    post(path: string, handlers: any) {
        router.post(path, handlers);
    }

    put(path: string, handlers: any) {
        router.put(path, handlers);
    }

    delete(path: string, handlers: any) {
        router.delete(path, handlers);
    }

    /////////////////////////
    ///////Add functions
    /////////////////////////
    addModel(model: typeof SequelizeModel){
        //Init the model object and push to array of sequelizeModels.
        model.init(model.fields(DataTypes), {sequelize: sequelizeConnection.sequelize, tableName: model._tableName(), modelName: model._modelName()});
        this.sequelizeModels.push(model);
    }

    addProcessListeners(server: Server){
        let name = this.options.name;
        process.on('SIGTERM', () => {
            console.log('Recived SIGTERM!');
            server.close(() => {
                sequelizeConnection.disconnect();
                console.log('Micro service %s shutdown complete.', name);
                process.exit(0);
            });
        });
        process.on('SIGINT', () => {
            console.log('Recived SIGINT!');
            server.close(() => {
                sequelizeConnection.disconnect();
                console.log('Micro service %s shutdown complete.', name);
                process.exit(0);
            });
        });
    }

    /////////////////////////
    ///////Endpoints
    /////////////////////////
    createDatabaseEndpoints(){
        this.post('/database/sync', (request: Request, response: Response) => {
            try {
                sequelizeConnection.sync(request.body.force)
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

    createHealthEndpoints() {
        let _options = this.options;

        this.get('/health', (request: Request, response: Response) => {
            try {
                response.status(httpStatus.OK).send({status: true});
            } catch (error) {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
            }
        });

        this.get('/health/report', (request: Request, response: Response) => {
            try {
                let routesArray: any = [];
                let baseURL = request.baseUrl;

                //Getting all registered routes from router
                router.stack.forEach((item) => {
                    let method = item.route.stack[0].method;
                    let url = baseURL + item.route.path;
                    routesArray.push({method, url});
                });

                let data = {
                    service: _options,
                    routes: routesArray
                };

                response.status(httpStatus.OK).send({status: true, data});
            } catch (error) {
                console.log(error);
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
            }
        });
    }

    createDefaultEndpoints(controller: Controller) {
        //Setup model first
        this.addModel(controller.model);
        
        //Getting URL from controller name and Setting up routes
        let baseURL = '/' + controller.constructor.name.replace('Controller', '').toLowerCase();

        //Setting up routes
        this.get(baseURL + '/:id', controller.selectOneByID);
        this.get(baseURL, controller.selectAll);
        this.get(baseURL + "/orderby/new", controller.selectAllAndOrderByCreatedAt);
        this.post(baseURL, controller.add);
        this.put(baseURL, controller.update);
        this.delete(baseURL + '/:id', controller.deleteOneByID);
    }
}

export default class IMicroService extends MicroService {
    constructor(options: any) {
        super(options);
    }

    startService() {
        super.startService();
    }

    get(path: string, handlers: any) {
        super.get(path, handlers);
    }

    post(path: string, handlers: any) {
        super.post(path, handlers);
    }

    put(path: string, handlers: any) {
        super.put(path, handlers);
    }

    delete(path: string, handlers: any) {
        super.delete(path, handlers);
    }

    createDefaultEndpoints(controller: Controller) {
        super.createDefaultEndpoints(controller);
    }
}