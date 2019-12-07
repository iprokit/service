//Import modules
import { Sequelize, AccessDeniedError, ConnectionRefusedError, HostNotFoundError, ConnectionError } from 'sequelize';
import mongoose, { Connection as Mongoose } from 'mongoose';
import httpStatus from 'http-status-codes';
import { Request, Response } from 'express';
import { EventEmitter } from 'events';

//Local Imports
import { Component, Post } from './microservice';
import RDBModel from './db.rdb.model';
import NoSQLModel from './db.nosql.model';
import Utility from './utility';
import Controller from './controller';

//DB Types.
export type DBTypes = RDBType | NoSQLType;
export type RDBType = 'mysql';
export type NoSQLType = 'mongo';

//Types: InitOptions
export type InitOptions = {
    type: DBTypes,
    paperTrail: boolean
};

//Types: AutoWireModelOptions
export type AutoWireModelOptions = {
    paths?: Array<string>,
    likeName?: string,
    excludes?: Array<string>
};

//Export Entity Types.
export type EntityOptions = {
    name: string,
    attributes: any,
}
    
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
    private readonly rdbModels: Array<typeof RDBModel>;
    private readonly noSQLModels: Array<typeof NoSQLModel>;

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
        this.rdbModels = new Array();
        this.noSQLModels = new Array();
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

    public getModels(){
        if(this.rdb){
            return this.rdbModels;
        }else if(this.noSQL){
            return this.noSQLModels;
        }
    }

    public getConnection(){
        if(this.rdb){
            return rdbConnection;
        }else if(this.noSQL){
            return noSQLConnection;
        }
    }

    public getReport(){
        try{
            let _models;
            if(this.rdb){
                _models = this.rdbModels;
            }else if(this.noSQL){
                _models = this.noSQLModels;
            }

            let models = new Array();
            _models.forEach((model: typeof RDBModel | typeof NoSQLModel) => {
                models.push({[model.name]: model.entityOptions.name});
            });

            const report = {
                init: {
                    name: this.name,
                    host: this.host,
                    type: this.type,
                    connected: this.connected
                },
                models: models
            }
            return report;
        }catch(error){
            return {}
        }
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public init(initOptions: InitOptions){
        //Load init options.
        this.type = initOptions.type;
        this.paperTrail = (initOptions.paperTrail === undefined) ? true: initOptions.paperTrail;

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

    /////////////////////////
    ///////Model Functions
    /////////////////////////
    public autoWireModels(autoWireOptions: AutoWireModelOptions){
        let paths = autoWireOptions.paths || ['/'];
        const likeName = autoWireOptions.likeName || 'model.js';
        const excludes = autoWireOptions.excludes || [];

        paths.forEach((path: string) => {
            let modelFiles = Utility.getFilePaths(path, likeName, excludes);
            modelFiles.forEach(modelFile => {
                const _Model = require(modelFile).default;

                if(_Model.prototype instanceof RDBModel && this.rdb){
                    this.initRDBModel(_Model);

                    //Add to Array
                    this.rdbModels.push(_Model);
                }else if(_Model.prototype instanceof NoSQLModel && this.noSQL){
                    this.initNoSQLModel(_Model);

                    //Add to Array
                    this.rdbModels.push(_Model);
                }else{
                    console.log('Could not initiatize model: %s', _Model.constructor.name);
                }
            });
        });

        //Associate models
        if(this.rdb){
            this.rdbModels.forEach(model => {
                //Associating model
                model.associate();
            });
        }
    }

    //TODO: Add createdby and updatedby in model inits(). If add is not required combine initRDBModel() and initNoSQLModel()

    private initRDBModel(model: typeof RDBModel){
        //Get data from model object.
        const paperTrail = this.paperTrail;
        const sequelize = rdbConnection;
        const modelName = model.name.replace('Model', '');
        const tableName = model.entityOptions.name;
        const attributes = model.entityOptions.attributes;

        //Logging the model before
        console.log('Initiating model: %s(%s)', modelName, tableName);

        //Initializing model
        model.init(attributes, {
            tableName: tableName,
            modelName: modelName,
            sequelize: sequelize,
            timestamps: paperTrail
        });
        model.hooks();
    }

    private initNoSQLModel(model: typeof NoSQLModel){
        //Get data from model object.
        const paperTrail = this.paperTrail;
        const mongoose = noSQLConnection;
        const modelName = model.name.replace('Model', '');
        const collectionName = model.entityOptions.name;
        const attributes = model.entityOptions.attributes;

        //Logging the model before
        console.log('Initiating model: %s(%s)', modelName, collectionName);

        //Initializing model
        model.init(attributes, {
            collectionName: collectionName,
            modelName: modelName,
            mongoose: mongoose,
            timestamps: paperTrail
        });
        model.hooks();
    }

    /////////////////////////
    ///////Connection Management
    /////////////////////////
    public connect(){
        return new Promise((resolve, reject) => {
            if(this.rdb){
                rdbConnection.authenticate()
                    .then(() => {
                        this.connected = true; //Connected Flag 
                        resolve({name: this.name, host: this.host, type: this.type});
                    }).catch((error) => {
                        this.connected = false; //Connected Flag 
                        if(error instanceof AccessDeniedError){
                            reject(new InvalidConnectionOptionsError('Access denied to the database.'));
                        }else if(error instanceof ConnectionRefusedError){
                            reject(new InvalidConnectionOptionsError('Connection refused to the database.'));
                        }else if(error instanceof HostNotFoundError){
                            reject(new InvalidConnectionOptionsError('Invalid database host.'));
                        }else if(error instanceof ConnectionError){
                            reject(new InvalidConnectionOptionsError('Could not connect to the database due to unknown connection issue.'));
                        }else{
                            reject(error);//Pass other errors.
                        }
                    });
            }else if(this.noSQL){
                noSQLConnection.on('connected', (error) => {
                    this.connected = true; //Connected Flag 
                    resolve({name: this.name, host: this.host, type: this.type});
                });
                noSQLConnection.on('error', (error) => {
                    this.connected = false; //Connected Flag
                    if(error.message.includes('Authentication failed')){
                        reject(new InvalidConnectionOptionsError('Connection refused to the database.'));
                    }else if(error.message.includes('getaddrinfo ENOTFOUND')){
                        reject(new InvalidConnectionOptionsError('Invalid database host.'));
                    }else{
                        reject(error);//Pass other errors.
                    }
                });
            }else{
                resolve();
            }
        });
    }

    public disconnect(){
        return new Promise((resolve, reject) => {
            if(this.rdb){
                rdbConnection.close()
                    .then(() => {
                        this.connected = false; //Connected Flag
                        resolve();
                    }).catch((error) => {
                        reject(error);//Pass other errors.
                    });
            }else if(this.noSQL){
                noSQLConnection.close()
                    .then(() => {
                        this.connected = false; //Connected Flag
                        resolve();
                    }).catch((error) => {
                        reject(error);//Pass other errors.
                    })
            }else{
                resolve();
            }
        });
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