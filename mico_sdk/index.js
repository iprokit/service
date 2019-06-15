//Import modules
import express from 'express'
import createError from 'http-errors'

//Init variables
let app = express();
let servicePort = 

class IproMicro {
    //Default Constructor
    constructor(){
        this.serviceID = '' //Create a UUID
        this.serviceName = ''
        this.serviceVersion = ''
        this.serviceType = ''
        this.servicePort = 3000 //Setting default port
        console.log(servicePort);
        this.serviceIP = '' //Get ip address
    }

    start(serviceConfig, environment){
        //Load service config
        this.serviceName = serviceConfig.serviceName
        this.serviceVersion = serviceConfig.serviceVersion
        this.serviceType = serviceConfig.serviceType

        this._initExpressServer(environment);
        this._initMQTTServer();
    }

    _initExpressServer(environment){
        //Setup Express
        //app.use(logger(environment));
        app.use(express.json());
        app.use(express.urlencoded({ extended: false }));

        // Error handler for 404
        app.use(function(req, res, next) {
            next(createError(404));
        });

        // Default error handler
        app.use(function(err, req, res, next) {
            res.locals.message = err.message;
            res.locals.error = req.app.get('env') === 'development' ? err : {};
            res.status(err.status || 500);
        });

        // Start server.
        app.listen(servicePort, () => {
            console.log("%s : v%s service started on port %s", serviceName, serviceVersion, servicePort);
        });
    }

    _initMQTTServer(){

    }
}

export default IproMicro;