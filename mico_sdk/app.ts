//Import modules
import express from 'express';
import httpStatus from 'http-status-codes';
import createError from 'http-errors';
import uuid from 'uuid/v1';
import {Sequelize} from 'sequelize'

//Local Imports
import DockerUtility from './docker.utility';
import SequelizeModel from './sequelize.model';
import SequelizeConnection from './sequelize.connection';
import Controller from './controller';

//Init variables
var app = express();
var router = express.Router();

//Export variables
export var name: string; //Service Name
export var sequelize: Sequelize;

class MicroService {
    options: any;
    sequelizeModels: Array<typeof SequelizeModel>;

    //Default Constructor
    constructor(options: any) {
        this.options = options;

        //First check if the name exists.
        //TODO: Get the default file name.
        if(this.options.name === undefined){
            throw new Error('Service name required');
        }
        name = this.options.name;
        
        //Init service variables.
        this.options.id = uuid();
        this.options.version = this.options.version !== undefined ? this.options.version: '1.0';
        this.options.type = this.options.type !== undefined ? this.options.type: 'api';
        this.options.port = this.options.port !== undefined ? this.options.port: 3000;
        this.options.ip = DockerUtility.getContainerIP();

        //Load sequelize
        this.sequelizeModels = new Array<typeof SequelizeModel>();
        if (options.hasOwnProperty('mysql')) {
            options.mysql.dialect = 'mysql';
            let sequelizeConnection = new SequelizeConnection(options.mysql);
            sequelize = sequelizeConnection.connect();
        }

        //Load express and router
        this.initExpressServer();

        //Load health services
        this.createHealthServices();
    }

    initExpressServer() {
        //Setup Express
        //TODO: Add CROS
        app.use(express.json());
        app.use(express.urlencoded({extended: false}));

        let url = '/' + this.options.type + '/' + this.options.name;
        app.use(url, router);

        // Error handler for 404
        app.use(function(req, res, next) {
            next(createError(404));
        });

        // Default error handler
        app.use(function(err: any, req: any, res: any, next: any) {
            res.locals.message = err.message;
            res.locals.error = req.app.get('env') === 'development' ? err : {};
            res.status(err.status || 500).send(err.message);
        });

        //TODO: Add listeners to terminate DB connection on end
    }

    startService() {
        //Assign associates to all models.
        this.sequelizeModels.forEach(sequelizeModel => {
            sequelizeModel.associate();
        });
        
        // Start server.
        app.listen(this.options.port, () => {
            console.log('%s micro service running on %s:%s', this.options.name, this.options.ip, this.options.port);
            console.log('%s : %o', this.options.name, {
                id: this.options.id,
                version: this.options.version,
                type: this.options.type
            });
        });
    }

    /////////////////////////
    ///////Router Functions
    /////////////////////////
    get(url: string, fn: any) {
        router.get(url, fn);
    }

    post(url: string, fn: any) {
        router.post(url, fn);
    }

    put(url: string, fn: any) {
        router.put(url, fn);
    }

    delete(url: string, fn: any) {
        router.delete(url, fn);
    }

    /////////////////////////
    ///////Controller Services
    /////////////////////////
    createDefaultServices(controller: Controller) {
        //Getting model from the controller and initializing.
        let model: any = controller.getModel();
        model.init();

        //Adding model to Array.
        this.sequelizeModels.push(model);

        //Getting URL from controller name and Setting up routes
        let baseURL = '/' + controller.getName();

        //Setting up routes
        this.get(baseURL + '/:id', controller.selectOneByID);
        this.get(baseURL, controller.selectAll);
        this.get(baseURL + "/orderBy/new", controller.selectAllAndOrderByCreatedAt);
        this.post(baseURL, controller.add);
        this.put(baseURL, controller.update);
        this.delete(baseURL + '/:id', controller.deleteOneByID);
    }

    /////////////////////////
    ///////Health Services
    /////////////////////////
    createHealthServices() {
        let _options = this.options;

        this.get('/health', function(request: any, response: any) {
            try {
                response.status(httpStatus.OK).send({status: true});
            } catch (error) {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
            }
        });

        this.get('/health/report', function(request: any, response: any) {
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
}

export default class IMicroService extends MicroService {
    constructor(config: any) {
        super(config);
    }

    startService() {
        super.startService();
    }

    get(url: string, fn: any) {
        super.get(url, fn);
    }

    post(url: string, fn: any) {
        super.post(url, fn);
    }

    put(url: string, fn: any) {
        super.put(url, fn);
    }

    delete(url: string, fn: any) {
        super.delete(url, fn);
    }

    createDefaultServices(controller: Controller) {
        super.createDefaultServices(controller);
    }
}