//Import modules
import { Sequelize, DataTypes, AccessDeniedError, ConnectionRefusedError, HostNotFoundError, ConnectionError } from 'sequelize';
import Mongoose, { Schema } from 'mongoose';
import httpStatus from 'http-status-codes';
import { Request, Response } from 'express';

//Local Imports
import { Component } from './microservice';
import RDBModel from './db.rdb.model';
import NoSQLModel from './db.nosql.model';
import DockerUtility from './docker.utility';
import FileUtility from './file.utility';
import { Execute } from './routes';

//RDS & NoSQL Types.
export type RDS = 'mysql';
export type NoSQL = 'mongo';

//Types: DBConnectionOptions
export type DBConnectionOptions = {
    name: string,
    username: string,
    password: string,
    host: string
}

//Types: DBInitOptions
export type DBInitOptions = {
    type: NoSQL | RDS,
    timezone?: string,
    autoWireModels: AutoWireOptions
};

//Types: AutoWireOptions
export type AutoWireOptions = {
    paths?: Array<string>,
    likeName?: string,
    excludes?: Array<string>
};

export default class DBManager implements Component{
    //Options
    private connectionOptions: DBConnectionOptions;
    private initOptions: DBInitOptions;

    //DB Types
    private RDS: boolean;
    private NoSQL: boolean;
    
    //Connection Object
    private rdbConnection: Sequelize;

    //Models
    private readonly rdbModels = new Array<typeof RDBModel>();
    private readonly noSQLModels = new Array<typeof NoSQLModel>();
    
    //Default Constructor
    public constructor(){
        //Load options
        this.loadOptions();
    }

    /////////////////////////
    ///////Gets & Sets
    /////////////////////////
    public isRDS(){
        return this.RDS;
    }

    public isNoSQL(){
        return this.NoSQL;
    }

    public isConnected(){
        //TODO: Implement this.
        return true;
    }

    public getModels(){
        if(this.RDS){
            return this.rdbModels;
        }else if(this.NoSQL){
            return this.noSQLModels;
        }
    }

    public getConnection(){
        if(this.RDS){
            return this.rdbConnection;
        }else if(this.NoSQL){
            return Mongoose.connection;
        }
    }

    public getOptions(){
        return {connectionOptions: this.connectionOptions, initOptions: this.initOptions};
    }

    public getReport(){
        let models = new Array();

        if(this.RDS){
            this.rdbModels.forEach((model) => {
                models.push({[model.name]: model.getTableName().toString()});
            });
        }else if(this.NoSQL){
            this.noSQLModels.forEach((model) => {
                models.push({[model.name]: model._collectionName().toString()});
            });
        }

        const report = {
            init: {
                name: this.connectionOptions.name,
                host: this.connectionOptions.host,
                type: this.initOptions.type,
                timezone: this.initOptions.timezone
            },
            models: models
        }
        return report;
    }

    /////////////////////////
    ///////Load Functions
    /////////////////////////
    private loadOptions(){
        //Try loading options from process.env
        this.connectionOptions = {
            name: process.env.DB_NAME,
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            host: process.env.DB_HOST || DockerUtility.getHostIP()
        };
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public init(initOptions: DBInitOptions){
        //Load init options.
        this.initOptions = initOptions;
        this.initOptions.timezone = this.initOptions.timezone || '+00:00';
        this.initOptions.autoWireModels = this.initOptions.autoWireModels || {};
        
        //Init DBController and inject endpoints.
        const dbController = new DBController();

        //Try loading a db based on type.
        if(this.initOptions.type === 'mysql'){
            //Set DB type
            this.RDS = true;

            //Load Connection
            this.loadRDBConnection(this.initOptions.type);

            //Load models
            this.autoWireRDBModels(this.initOptions.autoWireModels);

            //Load endpoints
            DBController.connection = this.getConnection();
            Execute('/db/sync')(DBController, dbController.syncRDB.name, {value: dbController.syncRDB});
        }else if(this.initOptions.type === 'mongo'){
            //Set DB type
            this.NoSQL = true;

            //Load models
            this.autoWireNoSQLModels(this.initOptions.autoWireModels);
        }else {
            throw new InvalidConnectionOptionsError('Invalid Database type provided.')
        }
    }

    /////////////////////////
    ///////RDB Functions
    /////////////////////////
    private loadRDBConnection(dialect: RDS){
        if(this.connectionOptions.name !== undefined){
            try{
                //Load Sequelize
                this.rdbConnection = new Sequelize(this.connectionOptions.name, this.connectionOptions.username, this.connectionOptions.password, {
                    host: this.connectionOptions.host,
                    dialect: dialect,
                    timezone: this.initOptions.timezone
                });
            }catch(error){
                throw error; //Pass other errors.
            }
        }else{
            throw new InvalidConnectionOptionsError('Invalid Database Name provided in .env.');
        }
    }

    private autoWireRDBModels(autoWireModels: AutoWireOptions){
        let paths = autoWireModels.paths || ['/'];
        const likeName = autoWireModels.likeName || 'model.js';
        const excludes = autoWireModels.excludes || [];

        //Adding files to Exclude.
        excludes.push('/node_modules');

        paths.forEach((path: string) => {
            let modelFiles = FileUtility.getFilePaths(path, likeName, excludes);
            modelFiles.forEach(modelFile => {
                const model = require(modelFile).default;

                this.initRDBModel(model);

                //Add to Array
                this.rdbModels.push(model);
            });
        });

        //Associate models
        this.rdbModels.forEach(model => {
            //Logging the model before
            console.log('Associating model: %s', model.name);
    
            //Associating model
            model.associate();
        });
    }

    private initRDBModel(model: typeof RDBModel){
        //Get data from model object.
        const fields = model.fields(DataTypes);
        const sequelize = this.rdbConnection;
        const modelName = model._modelName();
        const tableName = model._tableName();

        //Logging the model before
        console.log('Initiating model: %s(%s)', modelName, tableName);

        //Initializing model
        model.init(fields, {sequelize, tableName, modelName});
        model.hooks();
        model.validations();
    }

    /////////////////////////
    ///////NoSQL Functions
    /////////////////////////
    private autoWireNoSQLModels(autoWireModels: AutoWireOptions){
        let paths = autoWireModels.paths || ['/'];
        const likeName = autoWireModels.likeName || 'model.js';
        const excludes = autoWireModels.excludes || [];

        //Adding files to Exclude.
        excludes.push('/node_modules');

        paths.forEach((path: string) => {
            let modelFiles = FileUtility.getFilePaths(path, likeName, excludes);
            modelFiles.forEach(modelFile => {
                const model = require(modelFile).default;

                this.initNoSQLModel(model);

                //Add to Array
                this.noSQLModels.push(model);
            });
        });
    }

    private initNoSQLModel(model: typeof NoSQLModel){
        //Get data from model object.
        const fields = model.fields(Schema.Types);
        const modelName = model._modelName();
        const collectionName = model._collectionName();

        //Logging the model before
        console.log('Initiating model: %s(%s)', modelName, collectionName);

        //Initializing model
        model.init(fields, {collectionName, modelName});
    }

    /////////////////////////
    ///////Connection Management
    /////////////////////////
    public connect(){
        return new Promise((resolve, reject) => {
            if(this.RDS){
                this.rdbConnection.authenticate()
                    .then(() => {
                        resolve({name: this.connectionOptions.name, host: this.connectionOptions.host, type: this.initOptions.type});
                    }).catch((error) => {
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
            }else if(this.NoSQL){
                const uri = 'mongodb://' + this.connectionOptions.host;
                const options = {
                    dbName: this.connectionOptions.name,
                    user: this.connectionOptions.username,
                    pass: this.connectionOptions.password,
                    useNewUrlParser: true}
                Mongoose.connect(uri, options)
                    .then(() => {
                        resolve({name: this.connectionOptions.name, host: this.connectionOptions.host, type: this.initOptions.type});
                    }).catch((error) => {
                        if(error.message.includes('Authentication failed')){
                            reject(new InvalidConnectionOptionsError('Connection refused to the database.'));
                        }else if(error.message.includes('getaddrinfo ENOTFOUND')){
                            reject(new InvalidConnectionOptionsError('Invalid database host.'));
                        }else{
                            reject(error);//Pass other errors.
                        }
                    })
            }else{
                resolve();
            }
        });
    }

    public disconnect(){
        return new Promise((resolve, reject) => {
            if(this.RDS){
                this.rdbConnection.close()
                    .then(() => {
                        resolve();
                    }).catch((error) => {
                        reject(error);//Pass other errors.
                    });
            }else if(this.NoSQL){
                Mongoose.disconnect()
                    .then(() => {
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
export class InvalidConnectionOptionsError extends Error{
    constructor (message: string) {
        super(message);
        
        // Saving class name in the property of our custom error as a shortcut.
        this.name = this.constructor.name;
    
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
      }
}

/////////////////////////
///////RDBController
/////////////////////////
class DBController {
    public static connection: any;

    public syncRDB(request: Request, response: Response) {
        DBController.connection.sync({force: request.body.force})
            .then(() => {
                response.status(httpStatus.OK).send({ status: true, data: 'Database & tables synced!' });
            }).catch((error: any) => {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
            });
    };
}