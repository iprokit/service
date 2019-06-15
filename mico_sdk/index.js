//Import modules
import express from 'express'
import Router from 'express'
import createError from 'http-errors'
import ip from 'ip'
import uuid from 'uuid/v1'

//Init variables
let app = express();
let router = new Router();

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

        this.start();
    }

    start(){
        this._initExpressServer();
        this._initMQTTServer();
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

        // Start server.
        app.listen(this.servicePort, () => {
            console.log("%s micro service running on %s:%s", this.serviceName, this.serviceIP, this.servicePort);
            console.log('%s : %o', this.serviceName, {id: this.serviceID, version: this.serviceVersion, type: this.serviceType})
        });
    }

    _initMQTTServer(){

    }
}

class IMicroService extends MicroService {
    constructor(config){
        super(config)
    }

    get(url, fn){
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
}

export default IMicroService;