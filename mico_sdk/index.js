//Import modules
import express from 'express'
import createError from 'http-errors'
import ip from 'ip'
import uuid from 'uuid/v1'
import httpStatus from 'http-status-codes'

//Local Imports
import Controller from './controller';
import Sequelize from './sequelize';

//Init variables
var app = express();
var router = express.Router();

class MicroService {
    //Default Constructor
    constructor(config){
        this.serviceID = uuid();
        if(config.name == 'undefined' || config.name == null){
            throw new Error('Service name required');
        }else{
            this.serviceName = config.name
        }
        if(config.version == 'undefined' || config.version == null){
            this.serviceVersion = '1.0'
        }else{
            this.serviceVersion = config.version
        }
        if(config.type == 'undefined' || config.type == null){
            this.serviceType = 'api'
        }else{
            this.serviceType = config.type
        }
        if(config.port == 'undefined' || config.port == null){
            this.servicePort = 3000 //Setting default port
        }else{
            this.servicePort = config.port
        }
        this.serviceIP = ip.address()

        this._initExpressServer();
        
        //Load sequalize
        this.sequelize = new Sequelize(config.db.name, config.db.username);
    }

    _initExpressServer(){
        //Setup Express
        app.use(express.json());
        app.use(express.urlencoded({ extended: false }));

        var url = "/" + this.serviceType + "/" + this.serviceName
        app.use(url, router);

        // Error handler for 404
        app.use(function(req, res, next) {
            next(createError(404));
        });

        // Default error handler
        app.use(function(err, req, res, next) {
            res.locals.message = err.message;
            res.locals.error = req.app.get('env') === 'development' ? err : {};
            res.status(err.status || 500).send(err.message)
        });
    }

    startService(){
        // Start server.
        app.listen(this.servicePort, () => {
            console.log("%s micro service running on %s:%s", this.serviceName, this.serviceIP, this.servicePort);
            console.log('%s : %o', this.serviceName, {id: this.serviceID, version: this.serviceVersion, type: this.serviceType})
        });
    }

    /////////////////////////
    ///////Router Functions
    /////////////////////////
    get(url, fn){
        //subscribe
        //publish
        router.get(url, fn);
    }

    post(url, fn){
        router.post(url, fn);
    }

    put(url, fn){
        router.put(url, fn);
    }

    delete(url, fn){
        router.delete(url, fn);
    }

    /////////////////////////
    ///////CRUD Services
    /////////////////////////
    createCRUD(object){
        var controller = object

        if(!(object instanceof Controller)){
            //Model object case
            controller = new Controller(object);
        }

        this.get('/:id', controller.selectOneByID);
        this.get('/', controller.selectAll);
        this.post('/', controller.add);
        this.put('/', controller.update);
        this.delete('/:id', controller.deleteOneByID);
    }

    /////////////////////////
    ///////Health Services
    /////////////////////////
    _createHealth(){
        this.get('/health', function(request, response){
            try {
                response.status(httpStatus.OK).send({ status: true })
            }catch(error){
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error})
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

        this.get('/health/report', function(request, response){
            try {
                var routes = [];
                var baseURL = request.baseUrl;

                //Getting all registered routes from router
                router.stack.forEach((item) => {
                    var method = item.route.stack[0].method;
                    var url = baseURL + item.route.path;
                    routes.push({method, url});
                })

                response.status(httpStatus.OK).send({ status: true, data : {service: serviceObject, registeredRoutes: routes}});
            }catch(error){
                console.log(error);
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error});
            }
        });
    }
}

class IMicroService extends MicroService {
    constructor(config){
        super(config)
    }

    startService(){
        this._createHealth();
        super.startService();
    }

    get(url, fn){
        super.get(url, fn);
    }

    post(url, fn){
        super.post(url, fn);
    }

    put(url, fn){
        super.put(url, fn);
    }

    delete(url, fn){
        super.delete(url, fn);
    }

    createCRUD(object){
        super.createCRUD(object);
    }

    getSequalize(){
        return this.sequelize;
    }
}

export default IMicroService;