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

export default class MicroService {
    //Init variables.
    private app = express();
    private router = express.Router();

    //Init null variables.
    private options: any;
    private sequelizeConnection: SequelizeConnection;

    //Init constructors.
    private sequelizeModels: Array<typeof SequelizeModel> = new Array<typeof SequelizeModel>();

    //Default Constructor
    public constructor(options: any) {
        //TODO: Read dotenv from the project root.
        this.options = options;
        
        //Init service variables.
        this.options.id = uuid();
        this.options.name = this.options.name !== undefined ? this.options.name: this.constructor.name.replace('App', '');
        this.options.version = this.options.version !== undefined ? this.options.version: '1.0.0';
        this.options.type = this.options.type !== undefined ? this.options.type: 'API';
        this.options.port = this.options.port !== undefined ? this.options.port: 3000;
        this.options.ip = DockerUtility.getContainerIP();

        //Load sequelize
        if (options.hasOwnProperty('mysql')) {
            options.mysql.dialect = 'mysql';
            this.sequelizeConnection = new SequelizeConnection(options.mysql);
        }

        //Load express and router
        this.initExpressServer();

        //Load Endpoints
        this.createDatabaseEndpoints();
        this.createHealthEndpoints();

        //Loading any user level objects.
        this.init();

        //Start the server & DB connections.
        this.startService();
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

    public init(){}

    private startService() {
        //Call associate's from all the models
        this.sequelizeModels.forEach(sequelizeModel => {
            sequelizeModel.associate();
        });
        
        // Start server.
        const server = this.app.listen(this.options.port, () => {
            console.log('%s micro service running on %s:%s', this.options.name, this.options.ip, this.options.port);
            console.log('%s : %o', this.options.name, {
                id: this.options.id,
                version: this.options.version,
                type: this.options.type
            });

            //Starting database connection.
            this.sequelizeConnection.connect();
        });

        //Adding process listeners to stop server gracefully.
        this.addProcessListeners(server);
    }

    /////////////////////////
    ///////Router Functions
    /////////////////////////
    public get(path: string, handlers: any) {
        this.router.get(path, handlers);
    }

    public post(path: string, handlers: any) {
        this.router.post(path, handlers);
    }

    public put(path: string, handlers: any) {
        this.router.put(path, handlers);
    }

    public delete(path: string, handlers: any) {
        this.router.delete(path, handlers);
    }

    /////////////////////////
    ///////Add functions
    /////////////////////////
    public addModel(model: typeof SequelizeModel){
        //Init the model object and push to array of sequelizeModels.
        const fields = model.fields(DataTypes);
        const sequelize = this.sequelizeConnection.sequelize;
        const modelName = model._modelName();
        const tableName = (this.options.name + '_' + model._tableName()).toLowerCase();

        model.init(fields, {sequelize, tableName, modelName});
        this.sequelizeModels.push(model);
    }

    private addProcessListeners(server: Server){
        const name = this.options.name;
        const sequelizeConnection = this.sequelizeConnection;

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
    private createDatabaseEndpoints(){
        const sequelizeConnection = this.sequelizeConnection;

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

    private createHealthEndpoints() {
        const router = this.router;
        const options = this.options;

        this.get('/health', (request: Request, response: Response) => {
            try {
                response.status(httpStatus.OK).send({status: true});
            } catch (error) {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
            }
        });

        this.get('/health/report', (request: Request, response: Response) => {
            try {
                const routesArray: any = [];
                const baseURL = request.baseUrl;

                //Getting all registered routes from router
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

    public createDefaultEndpoints(controller: Controller) {
        //Setup model first
        this.addModel(controller.model);
        
        //Getting URL from controller name and Setting up routes
        const baseURL = '/' + controller.name.replace('Controller', '').toLowerCase();

        //Setting up routes
        this.get(baseURL + '/:id', controller.selectOneByID);
        this.get(baseURL, controller.selectAll);
        this.get(baseURL + "/orderby/new", controller.selectAllAndOrderByCreatedAt);
        this.post(baseURL, controller.add);
        this.put(baseURL, controller.update);
        this.delete(baseURL + '/:id', controller.deleteOneByID);
    }
}