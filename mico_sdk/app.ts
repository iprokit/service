//Import modules
import express from 'express';
import httpStatus from 'http-status-codes';
import createError from 'http-errors';
import uuid from 'uuid/v1';
import {Sequelize} from 'sequelize'

//Local Imports
import Controller from './controller';
import SequelizeModel from './sequelize.model';
import SequelizeConnection from './sequelize.connection';
import DockerUtility from './docker.utility';

//Init variables
var app = express();
var router = express.Router();

//Export variables
export var serviceName: string;
export var sequelize: Sequelize;

//Init null variables
var serviceID: string;
var serviceVersion: string;
var serviceType: string;
var servicePort: number;
var serviceIP: string;
var dbConfig: any;
var sequelizeModels: Array<typeof SequelizeModel>;

class MicroService {
    sequelizeConnection: SequelizeConnection;

    //Default Constructor
    constructor(config: any) {
        if (!config.hasOwnProperty('name') || config.name == '') {
            throw new Error('Service name required');
        } else {
            serviceName = config.name;
        }

        serviceID = uuid();
        serviceVersion = config.version || '1.0';
        serviceType = config.type || 'api';
        servicePort = config.port || 3000;
        serviceIP = DockerUtility.getContainerIP();

        sequelizeModels = new Array<typeof SequelizeModel>();

        //Load sequelize
        if (config.hasOwnProperty('mysql')) {
            this.initSequelizeConnection(config.mysql)
        }

        //Load express and router
        this.initExpressServer();

        //Load health services
        this.createHealthServices();
    }

    initSequelizeConnection(mysql: any){
        mysql.dialect = 'mysql';
        this.sequelizeConnection = new SequelizeConnection(mysql);
        this.sequelizeConnection.start();
        
        dbConfig = mysql;
        //Securing sensitive information
        dbConfig.username = 'xxxxxxxxxx';
        dbConfig.password = 'xxxxxxxxxx';

        sequelize = this.sequelizeConnection.getConnection();
    }

    initExpressServer() {
        //Setup Express
        app.use(express.json());
        app.use(express.urlencoded({extended: false}));

        let url = '/' + serviceType + '/' + serviceName;
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

        //Add listeners to terminate DB connection on end
    }

    startService() {
        //Assign associates to all models.
        sequelizeModels.forEach(sequelizeModel => {
            sequelizeModel.associate();
        });
        
        // Start server.
        app.listen(servicePort, () => {
            console.log('%s micro service running on %s:%s', serviceName, serviceIP, servicePort);
            console.log('%s : %o', serviceName, {
                id: serviceID,
                version: serviceVersion,
                type: serviceType
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
        sequelizeModels.push(model);

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
        this.get('/health', function(request: any, response: any) {
            try {
                response.status(httpStatus.OK).send({status: true});
            } catch (error) {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
            }
        });

        let serviceObject = {
            id: serviceID,
            name: serviceName,
            version: serviceVersion,
            type: serviceType,
            port: servicePort,
            ip: serviceIP,
            host: DockerUtility.getHostIP()
        };

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
                    service: serviceObject,
                    routes: routesArray,
                    db: dbConfig
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