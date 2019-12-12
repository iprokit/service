//Import modules
import { Sequelize, AccessDeniedError, ConnectionRefusedError, HostNotFoundError, ConnectionError } from 'sequelize';
import mongoose, { Connection as Mongoose } from 'mongoose';
import httpStatus from 'http-status-codes';
import { Request, Response } from 'express';
import { EventEmitter } from 'events';

//Local Imports
import { Component, Post, Events } from './microservice';
import RDBModel from './db.rdb.model';
import NoSQLModel from './db.nosql.model';
import Utility from './utility';
import Controller from './controller';

//DB Types.
export type DBTypes = RDBType | NoSQLType;
export type RDBType = 'mysql';
export type NoSQLType = 'mongo';
    
//Connection Objects
let rdbConnection: Sequelize;
let noSQLConnection: Mongoose;

export default class DBManager extends EventEmitter implements Component {
    //DB Variables.
    private paperTrail: boolean;
    private type: DBTypes;
    private name: string;
    private username: string;
    private password: string;
    private host: string;

    //DB Types
    private rdb: boolean;
    private noSQL: boolean;

    //Models
    private readonly models: Array<typeof RDBModel | typeof NoSQLModel>;

    private connected: boolean;

    //DB Controller
    private readonly dbController: DBController;
    
    //Default Constructor
    public constructor(){
        //Call super for EventEmitter.
        super();

        //Init db variables from env.
        this.host = process.env.DB_HOST || Utility.getHostIP();
        this.name = process.env.DB_NAME;
        this.username = process.env.DB_USERNAME;
        this.password = process.env.DB_PASSWORD;

        //Init variables.
        this.models = new Array();
        this.connected = false;
        this.dbController = new DBController();
    }

    /////////////////////////
    ///////Gets & Sets
    /////////////////////////
    public isRDB(){
        return this.rdb;
    }

    public isNoSQL(){
        return this.noSQL;
    }

    public isConnected(){
        return this.connected;
    }

    public getReport(){
        let models = new Array();

        this.models.forEach(model => {
            models.push({[model.name]: model.entityName});
        });

        return {
            init: {
                name: this.name,
                host: this.host,
                type: this.type,
                connected: this.connected
            },
            models: models
        }
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public init(type: DBTypes, paperTrail?: boolean){
        //Load init options.
        this.type = type;
        this.paperTrail = (paperTrail === undefined) ? true: paperTrail;

        //Try loading a db connection based on type.
        if(this.type === 'mysql'){
            //Set DB type
            this.rdb = true;

            //Init Connection
            this.initRDBConnection(this.type);

            //Sync Endpoint.
            Post('/db/sync', true)(DBController, this.dbController.syncRDB.name, {value: this.dbController.syncRDB});
        }else if(this.type === 'mongo'){
            //Set DB type
            this.noSQL = true;

            //Init Connection
            this.initNoSQLConnection();
        }else {
            throw new InvalidConnectionOptionsError('Invalid Database type provided.')
        }
    }

    private initRDBConnection(dialect: RDBType){
        if(this.name !== undefined){
            try{
                //Load Sequelize
                const options = {
                    host: this.host,
                    dialect: dialect
                }
                rdbConnection = new Sequelize(this.name, this.username, this.password, options);
            }catch(error){
                throw error; //Pass other errors.
            }
        }else{
            throw new InvalidConnectionOptionsError('Invalid Database Name provided in .env.');
        }
    }

    private initNoSQLConnection(){
        if(this.name !== undefined){
            try{
                //Load Mongoose
                const uri = 'mongodb://' + this.host;
                const options = {
                    dbName: this.name,
                    user: this.username,
                    pass: this.password,
                    useNewUrlParser: true
                }
                noSQLConnection = mongoose.createConnection(uri, options);
            }catch(error){
                throw error; //Pass other errors.
            }
        }else{
            throw new InvalidConnectionOptionsError('Invalid Database Name provided in .env.');
        }
    }

    public initModel(model: any){
        if(model.prototype instanceof RDBModel && this.rdb){
            this.initRDBModel(model);
        }else if(model.prototype instanceof NoSQLModel && this.noSQL){
            this.initNoSQLModel(model);
        }else{
            //TODO: Throw Wrong DB loaded.
        }
    }

    /////////////////////////
    ///////Model Functions
    /////////////////////////
    private initRDBModel(model: typeof RDBModel){
        //Get data from model object.
        const paperTrail = this.paperTrail;
        const sequelize = rdbConnection;
        const modelName = model.name.replace('Model', '');
        const tableName = model.entityName;
        const attributes = model.entityAttributes;

        //TODO: check if attribues are null;

        this.emit(Events.INIT_MODEL, modelName, tableName, model);

        //Initializing model
        model.init(attributes, {
            tableName: tableName,
            modelName: modelName,
            sequelize: sequelize,
            timestamps: paperTrail
        });
        model.hooks();

        //Add to Array.
        this.models.push(model);
    }

    private initNoSQLModel(model: typeof NoSQLModel){
        //Get data from model object.
        const paperTrail = this.paperTrail;
        const mongoose = noSQLConnection;
        const modelName = model.name.replace('Model', '');
        const collectionName = model.entityName;
        const attributes = model.entityAttributes;

        //TODO: check if attribues are null;

        this.emit(Events.INIT_MODEL, modelName, collectionName, model);

        //Initializing model
        model.init(attributes, {
            collectionName: collectionName,
            modelName: modelName,
            mongoose: mongoose,
            timestamps: paperTrail
        });
        model.hooks();

        //Add to Array.
        this.models.push(model);
    }

    /////////////////////////
    ///////Connection Management
    /////////////////////////
    public connect(){
        if(this.rdb){
            //Associate models
            this.models.forEach((model: any) => {
                model.associate();
            });

            //Start Connection.
            rdbConnection.authenticate()
                .then(() => {
                    this.connected = true; //Connected Flag 
                    this.emit(Events.DB_CONNECTED, {name: this.name, host: this.host, type: this.type});
                }).catch((error) => {
                    this.connected = false; //Connected Flag 
                    if(error instanceof AccessDeniedError){
                        throw new InvalidConnectionOptionsError('Access denied to the database.');
                    }else if(error instanceof ConnectionRefusedError){
                        throw new InvalidConnectionOptionsError('Connection refused to the database.');
                    }else if(error instanceof HostNotFoundError){
                        throw new InvalidConnectionOptionsError('Invalid database host.');
                    }else if(error instanceof ConnectionError){
                        throw new InvalidConnectionOptionsError('Could not connect to the database due to unknown connection issue.');
                    }else{
                        throw error;//Pass other errors.
                    }
                });
        }else if(this.noSQL){
            //Start Connection.
            noSQLConnection.once('connected', (error) => {
                this.connected = true; //Connected Flag 
                this.emit(Events.DB_CONNECTED, {name: this.name, host: this.host, type: this.type});
            });
            noSQLConnection.on('error', (error) => {
                this.connected = false; //Connected Flag
                if(error.message.includes('Authentication failed')){
                    throw new InvalidConnectionOptionsError('Connection refused to the database.');
                }else if(error.message.includes('getaddrinfo ENOTFOUND')){
                    throw new InvalidConnectionOptionsError('Invalid database host.');
                }else if(error.message.includes('connection timed out')){
                    console.log('Connection timed out');
                }else{
                    throw error;//Pass other errors.
                }
            });
        }
    }

    public disconnect(callback?: Function){
        if(this.rdb){
            rdbConnection.close()
                .then(() => {
                    this.connected = false; //Connected Flag
                    this.emit(Events.DB_DISCONNECTED);
                    if(callback){
                        callback();
                    }
                });
        }else if(this.noSQL){
            noSQLConnection.close(() => {
                this.connected = false; //Connected Flag
                this.emit(Events.DB_DISCONNECTED);
                if(callback){
                    callback();
                }
            });
        }else{
            if(callback){
                callback();
            }
        }
    }
}

/////////////////////////
///////Error Classes
/////////////////////////
export class InvalidConnectionOptionsError extends Error {
    constructor(message: string) {
        super(message);
        
        // Saving class name in the property of our custom error as a shortcut.
        this.name = this.constructor.name;
    
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
      }
}

export class NoRecordsFoundError extends Error {
    constructor() {
        super('No records found!');
        
        // Saving class name in the property of our custom error as a shortcut.
        this.name = this.constructor.name;
    
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
      }
}

/////////////////////////
///////RDBController
/////////////////////////
class DBController extends Controller {
    public syncRDB(request: Request, response: Response) {
        const force = request.body.force || false;
        rdbConnection.sync({force: force})
            .then(() => {
                response.status(httpStatus.OK).send({ status: true, data: 'Database & tables synced!' });
            }).catch((error: any) => {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
            });
    };
}