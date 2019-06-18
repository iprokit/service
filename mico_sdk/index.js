//Import modules
import express from 'express'
import httpStatus from 'http-status-codes'
import createError from 'http-errors'
import uuid from 'uuid/v1'

//Local Imports
import Controller from './controller'
import DockerUtility from './docker.utility'
import SequelizeConnection from './db.sequelize.connection'

//Init variables
var app = express();
var router = express.Router();
var docker = new DockerUtility();

class MicroService {
    //Default Constructor
    constructor(config) {
        if (!config.hasOwnProperty('name') || config.name === '') {
            throw new Error("Service name required");
        } else {
            this.serviceName = config.name;
        }

        this.serviceID = uuid();
        this.serviceVersion = config.version || '1.0';
        this.serviceType = config.type || 'api';
        this.servicePort = config.port || 3000;
        this.serviceIP = docker.getContainerIP();

        this._initExpressServer();

        //Load sequelize
        if(config.hasOwnProperty('mysql')){
            config.mysql.dialect = 'mysql';
            this.sequelizeConnection = new SequelizeConnection(config.mysql);
            this.sequelizeConnection.start();

            this.sequelizeConfig = config.mysql;
            this.sequelizeConfig.username = 'xxxxxxxxxx';
            this.sequelizeConfig.password = 'xxxxxxxxxx';
        }
    }

    _initExpressServer() {
        //Setup Express
        app.use(express.json());
        app.use(express.urlencoded({ extended: false }));

        var url = "/" + this.serviceType + "/" + this.serviceName;
        app.use(url, router);

        // Error handler for 404
        app.use(function (req, res, next) {
            next(createError(404));
        });

        // Default error handler
        app.use(function (err, req, res, next) {
            res.locals.message = err.message;
            res.locals.error = req.app.get('env') === 'development' ? err : {};
            res.status(err.status || 500).send(err.message);
        });

        //Terminate DB connection on end
    }

    startService() {
        // Start server.
        app.listen(this.servicePort, () => {
            console.log("%s micro service running on %s:%s", this.serviceName, this.serviceIP, this.servicePort);
            console.log("%s : %o", this.serviceName, { id: this.serviceID, version: this.serviceVersion, type: this.serviceType })
        });
    }

    /////////////////////////
    ///////Router Functions
    /////////////////////////
    get(url, fn) {
        router.get(url, fn);
    }

    post(url, fn) {
        router.post(url, fn);
    }

    put(url, fn) {
        router.put(url, fn);
    }

    delete(url, fn) {
        router.delete(url, fn);
    }

    /////////////////////////
    ///////CRUD Services
    /////////////////////////
    createCRUD(object) {
        var controller = object

        if (!(object instanceof Controller)) {
            //Model object case
            controller = new Controller(object);
        }//Might need to modify this.

        this.get('/:id', controller.selectOneByID);
        this.get('/', controller.selectAll);
        this.post('/', controller.add);
        this.put('/', controller.update);
        this.delete('/:id', controller.deleteOneByID);
    }

    /////////////////////////
    ///////Health Services
    /////////////////////////
    _createHealth() {
        this.get('/health', function (request, response) {
            try {
                response.status(httpStatus.OK).send({ status: true })
            } catch (error) {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error })
            }
        });

        var serviceObject = {
            id: this.serviceID,
            name: this.serviceName,
            version: this.serviceVersion,
            type: this.serviceType,
            port: this.servicePort,
            ip: this.serviceIP,
        }

        var sequelizeObject = this.sequelizeConfig;

        this.get('/health/report', function (request, response) {
            try {
                var routes = [];
                var baseURL = request.baseUrl;

                //Getting all registered routes from router
                router.stack.forEach((item) => {
                    var method = item.route.stack[0].method;
                    var url = baseURL + item.route.path;
                    routes.push({ method, url });
                });

                var data = {
                    service: serviceObject,
                    registeredRoutes: routes,
                    db: sequelizeObject
                }

                response.status(httpStatus.OK).send({ status: true, data });
            } catch (error) {
                console.log(error);
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error });
            }
        });
    }
}

class IMicroService extends MicroService {
    constructor(config) {
        super(config)
    }

    startService() {
        this._createHealth();
        super.startService();
    }

    get(url, fn) {
        super.get(url, fn);
    }

    post(url, fn) {
        super.post(url, fn);
    }

    put(url, fn) {
        super.put(url, fn);
    }

    delete(url, fn) {
        super.delete(url, fn);
    }

    createCRUD(object) {
        super.createCRUD(object);
    }

    getSequelize() {
        if(this.sequelizeConnection != null){
            return this.sequelizeConnection.getSequelize();
        }else{
            throw new Error('Sequelize connection object does not exist.');
        }
    }
}

export default IMicroService;