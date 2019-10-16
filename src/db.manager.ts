//Import modules
import { Sequelize, DataTypes, AccessDeniedError, ConnectionRefusedError, HostNotFoundError, ConnectionError } from 'sequelize';
import Mongoose, { Schema } from 'mongoose';
import httpStatus from 'http-status-codes';
import { Request, Response } from 'express';

//Local Imports
import RDBModel from './db.rdb.model';
import NoSQLModel from './db.nosql.model';
import DockerUtility from './docker.utility';
import FileUtility from './file.utility';
import { Report, Execute } from './routes';

//RDS/NoSQL Types.
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

export default class DBManager {
    //Options
    public connectionOptions: DBConnectionOptions;
    public initOptions: DBInitOptions;

    //DB Types
    public RDS: boolean;
    public NoSQL: boolean;
    
    //Connection Object
    public rdbConnection: Sequelize;

    //Models
    public readonly models = new Array();
    
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
        
        //Auto call, to create DB endpoints.
        //TODO: Attach decorators dynamically.
        new DBController();
        DBController.dbManager = this;

        //Try loading a db based on type.
        if(this.initOptions.type === 'mysql'){
            //Set DB type
            this.RDS = true;

            //Load Connection
            this.loadRDBConnection(this.initOptions.type);

            //Load models
            this.autoWireRDBModels(this.initOptions.autoWireModels);
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
                this.models.push(model);
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
        model.init(fields, {collectionName: collectionName});
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
                    .then((connection) => {
                        resolve({name: this.connectionOptions.name, host: this.connectionOptions.host, type: this.initOptions.type});
                    }).catch((error) => {
                        //TODO: Add other errors.
                        reject(error);//Pass other errors.
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
    public static dbManager: DBManager;

    @Report('/db/report')
    public getRDBOptions(request: Request, response: Response) {
        const _models = DBController.dbManager.models;
        let models = new Array<{[modelName: string]: string}>();

        const connectionOptions = DBController.dbManager.connectionOptions;
        const initOptions = DBController.dbManager.initOptions;

        const dbOptions = {
            name: connectionOptions.name,
            host: connectionOptions.host,
            type: initOptions.type,
            timezone: initOptions.timezone
        }

        if(DBController.dbManager.RDS){
            _models.forEach((model) => {
                models.push({[model.name]: model.getTableName()});
            });
        }else if(DBController.dbManager.NoSQL){
            _models.forEach((model) => {
                models.push({[model.name]: model._collectionName()});
            });
        }
        response.status(httpStatus.OK).send({ status: true, db: dbOptions, models: models });
    };

    @Execute('/db/sync')
    public syncRDB(request: Request, response: Response) {
        const db = DBController.dbManager.rdbConnection;

        //TODO: Add noSQL sync.
        db.sync({force: request.body.force})
            .then(() => {
                response.status(httpStatus.OK).send({ status: true, data: 'Database & tables synced!' });
            }).catch((error: any) => {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
            });
    };
}