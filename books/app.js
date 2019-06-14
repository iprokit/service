//ENVIRNOMENT VARIABLES IMPORT
//Import Modules or Paths
import express from 'express'
import logger from 'morgan'
import mosca from 'mosca'
import expressWs from 'express-ws'
import createError from 'http-errors'
import cookieParser from 'cookie-parser'
//Routes
import router from './router'
import Sequelize from 'sequelize'
import dotenv from 'dotenv'
dotenv.config()

var options = {
    id: 'AQU_MQTT',
    port: Number(process.env.PORT) || 1881,
    keepalive: 30,
    protocolId: 'MQTT',
    protocolVersion: 4,
    clean: true,                  //set to false to receive QoS 1 and 2 messages while offline
    reconnectPeriod: 1000,
    connectTimeout: 30 * 1000,
    will: {                       //in case of any abnormal client close this message will be fired
        topic: 'ErrorMsg',
        payload: 'Connection Closed abnormally..!',
        qos: 0,
        retain: false
    }
}

let mqttServer = new mosca.Server(options)

//express
var app = express();
expressWs(app)

app.ws('/mqtt', function (ws, req) {
    mqttServer.attachWebsocket(ws)
})

//Express 
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.set('view engine', 'jade');

//Services
app.use('/api/books', router)
// catch 404 and forward to error handler
app.use(function (req, res, next) {
    next(createError(404));
});
// error handler
app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    // render the error page
    res.status(err.status || 500);
    res.render('error');
});
const port = process.env.NODE_PORT || 3000;
app.listen(port, () => {
    console.log("Book micro service running on", port);
});

// //Export app object
// export default app;

//Squelieze configuration
//export function sequelize() {
    export const sequelize = new Sequelize(process.env.DB_NAME || 'feed_db', process.env.DB_USERNAME, process.env.DB_PASSWORD, {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: process.env.DB_DIALECT || 'mysql',
        operatorsAliases: false,
        pool: {
            max: process.env.DB_MAX_POOL || 3,
            min: process.env.DB_MIN_POOL || 2,
            acquire: process.env.DB_ACQUIRE_POOL || 30000,
            idle: process.env.DB_IDLE_POOL || 10000
        }
    });
    sequelize.sync({ force: false })
        .then(() => {
            console.log(`Database & tables created!`)
        })
        .catch(error => {
            console.log("Error is................", error)
        })
//}

// export function app(){
//     let mqttServer = new mosca.Server(options)

//     //express
//     var app = express();
//     expressWs(app)
    
//     app.ws('/mqtt', function (ws, req) {
//         mqttServer.attachWebsocket(ws)
//     })
    
//     //Express 
//     app.use(logger('dev'));
//     app.use(express.json());
//     app.use(express.urlencoded({ extended: false }));
//     app.use(cookieParser());
//     app.set('view engine', 'jade');
    
//     //Services
//     app.use('/api/books', router)
//     // catch 404 and forward to error handler
//     app.use(function (req, res, next) {
//         next(createError(404));
//     });
//     // error handler
//     app.use(function (err, req, res, next) {
//         // set locals, only providing error in development
//         res.locals.message = err.message;
//         res.locals.error = req.app.get('env') === 'development' ? err : {};
//         // render the error page
//         res.status(err.status || 500);
//         res.render('error');
//     });
//     const port = process.env.NODE_PORT || 3000;
//     app.listen(port, () => {
//         console.log("Book micro service running on", port);
//     });
// }

//Exports above all functions here..............
export default {app,sequelize}