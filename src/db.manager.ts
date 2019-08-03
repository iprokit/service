//Import modules
import { Sequelize, DataTypes, AccessDeniedError, ConnectionRefusedError, HostNotFoundError, ConnectionError } from 'sequelize';
import httpStatus from 'http-status-codes';
import { Request, Response } from 'express';

//Local Imports
import { Endpoint } from './app';
import RDBModel from './db.rdb.model';
import DockerUtility from './docker.utility';
import FileUtility from './file.utility';

//SQL Types.
const MYSQL = 'mysql'
export type SQL = typeof MYSQL;

//NoSQL Types.
const MONGO = 'mongo';
export type NoSQL = typeof MONGO;

//Types: DBConnectionOptions
export type DBConnectionOptions = {
    name: string,
    username: string,
    password: string,
    host: string
}

//Types: DBInitOptions
export type DBInitOptions = {
    type: NoSQL | SQL,
    timezone?: string,
    autoWireModels: AutoWireOptions
};

//Types: AutoWireOptions
export type AutoWireOptions = {
    paths?: Array<string>,
    likeName?: string,
    excludes?: Array<string>
};

export default class DBManager{
    //Options
    private connectionOptions: DBConnectionOptions;
    private initOptions: DBInitOptions;
    
    //Connection Object
    private db: Sequelize;

    //Models
    public readonly models = new Array<typeof RDBModel>();
    public readonly endpoints = new Array<Endpoint>();
    
    //Default Constructor
    public constructor(){
        //Load options
        this.loadOptions();
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

        //Try loading a db based on type.
        if(this.initOptions.type === MYSQL){
            //Load Connection
            this.loadRDBConnection(this.initOptions.type);

            //Load models
            this.autoWireRDBModels(this.initOptions.autoWireModels);

            //Map endpoints
            this.mapRDBEndpoints();
        }else if(this.initOptions.type === MONGO){
            this.loadNoSQLConnection(this.initOptions.type);
        }else {
            throw new InvalidConnectionOptions('Invalid Database type provided.')
        }
    }

    /////////////////////////
    ///////RDB Functions
    /////////////////////////
    private loadRDBConnection(dialect: SQL){
        if(this.connectionOptions.name !== undefined){
            try{
                //Load Sequelize
                this.db = new Sequelize(this.connectionOptions.name, this.connectionOptions.username, this.connectionOptions.password, {
                    host: this.connectionOptions.host,
                    dialect: dialect,
                    timezone: this.initOptions.timezone
                });
            }catch(error){
                throw error; //Pass other errors.
            }
        }else{
            throw new InvalidConnectionOptions('Invalid Database Name provided in .env.');
        }
    }

    private autoWireRDBModels(autoWireModels: AutoWireOptions){
        const paths = autoWireModels.paths || ['/'];
        const likeName = autoWireModels.likeName || 'model.js';
        const excludes = autoWireModels.excludes || [];

        //Adding files to Exclude.
        excludes.push('/node_modules');

        paths.forEach((path: string) => {
            const modelFiles = FileUtility.getFilePaths(path, likeName, excludes);
            modelFiles.forEach(modelFile => {
                const model = require(modelFile).default;

                this.setupRDBModel(model);

                //Add to Array
                this.models.push(model);
            });
        });

        //Associate models
        this.models.forEach(model => {
            //Logging the model before
            console.log('Associating model: %s', model.name);
    
            //Associating model
            model.associate();
        });
    }

    private setupRDBModel(model: typeof RDBModel){
        //Init the model object and push to array of rdbModels.
        const fields = model.fields(DataTypes);
        const sequelize = this.db;
        const modelName = model._modelName();
        const tableName = (global.service.name + '_' + model._tableName()).toLowerCase();

        //Logging the model before
        console.log('Initiating model: %s(%s)', modelName, tableName);

        //Initializing model
        model.init(fields, {sequelize, tableName, modelName});
        model.hooks();
        model.validations();
    }

    private mapRDBEndpoints(){
        //Adding endpoints.
        this.endpoints.push({method: 'get', url: '/db/report', fn: getRDBOptions});
        this.endpoints.push({method: 'post', url: '/db/sync', fn: syncRDB});

        //Sudo objects to pass into promise. As this keyword is not available.
        const dbOptions = {
            name: this.connectionOptions.name,
            host: this.connectionOptions.host,
            type: this.initOptions.type,
            timezone: this.initOptions.timezone
        }
        const db = this.db;
        const models = this.models;

        //Endpoint functions.
        function getRDBOptions(request: Request, response: Response) {
            const _models = new Array<{[modelName: string]: string}>();

            models.forEach((model) => {
                _models.push({[model.name]: model.getTableName().toString()});
            });
            response.status(httpStatus.OK).send({ status: true, db: dbOptions, models: _models });
        };

        function syncRDB(request: Request, response: Response) {
            db.sync({force: request.body.force})
                .then(() => {
                    response.status(httpStatus.OK).send({ status: true, data: 'Database & tables synced!' });
                }).catch((error: any) => {
                    response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
                });
        };
    }

    /////////////////////////
    ///////NoSQL Functions
    /////////////////////////
    private loadNoSQLConnection(type: NoSQL){
        console.log('Mongo to be implemented.');
    }

    /////////////////////////
    ///////Connection Management
    /////////////////////////
    public connect(){
        return new Promise((resolve, reject) => {
            if(this.db !== undefined){
                this.db.authenticate()
                    .then(() => {
                        resolve({name: this.connectionOptions.name, host: this.connectionOptions.host, type: this.initOptions.type});
                    }).catch((error) => {
                        if(error instanceof AccessDeniedError){
                            reject(new InvalidConnectionOptions('Access denied to the database.'));
                        }else if(error instanceof ConnectionRefusedError){
                            reject(new InvalidConnectionOptions('Connection refused to the database.'));
                        }else if(error instanceof HostNotFoundError){
                            reject(new InvalidConnectionOptions('Invalid database host.'));
                        }else if(error instanceof ConnectionError){
                            reject(new InvalidConnectionOptions('Could not connect to the database due to unknown connection issue.'));
                        }else{
                            reject(error);//Pass other errors.
                        }
                    });
            }else{
                resolve(null);
            }
        });
    }

    public disconnect(){
        return new Promise((resolve, reject) => {
            if(this.db !== undefined){
                this.db.close()
                    .then(() => {
                        resolve({name: this.connectionOptions.name, host: this.connectionOptions.host, type: this.initOptions.type});
                    }).catch((error) => {
                        reject(error);//Pass other errors.
                    });
            }else{
                resolve(null);
            }
        });
    }
}

/////////////////////////
///////Error Classes
/////////////////////////
export class InvalidConnectionOptions extends Error{
    constructor (message: string) {
        super(message);
        
        // Saving class name in the property of our custom error as a shortcut.
        this.name = this.constructor.name;
    
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
      }
}