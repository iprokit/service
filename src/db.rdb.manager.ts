//Import modules
import Promise from 'bluebird';
import { EventEmitter } from 'events';
import { Sequelize, Dialect, Op, ModelAttributes, DataTypes, AccessDeniedError, ConnectionRefusedError, HostNotFoundError, ConnectionError } from 'sequelize';

//Export Libs
export { Sequelize as RDB, Op as RDBOp, DataTypes as RDBDataTypes, Dialect as RDBDialect};

//Local Imports
import { Client, Events } from './microservice';
import RDBModel from './db.rdb.model';

export default class RDBManager extends EventEmitter implements Client {
    //RDB Variables.
    private _paperTrail: boolean;
    private _connected: boolean;

    //Connection Objects
    public dbType: Dialect;
    public dbHost: string;
    public dbName: string;
    public dbUsername: string;
    public dbPassword: string;
    private _connection: Sequelize;
    
    //Default Constructor
    public constructor(dialect: Dialect, paperTrail?: boolean){
        //Call super for EventEmitter.
        super();

        //Validate type
        this.dbType = dialect;
        if(!this.dbType){
            throw new ConnectionOptionsError('Invalid Database dialect provided.');
        }

        //Validate host
        this.dbHost = process.env.DB_HOST;
        if(!this.dbHost){
            throw new ConnectionOptionsError('Invalid DB_NAME provided in .env.');
        }

        //Validate name
        this.dbName = process.env.DB_NAME;
        if(!this.dbName){
            throw new ConnectionOptionsError('Invalid DB_NAME provided in .env.');
        }

        //Validate username
        this.dbUsername = process.env.DB_USERNAME;
        if(!this.dbUsername){
            throw new ConnectionOptionsError('Invalid DB_USERNAME provided in .env.');
        }

        //Validate password
        this.dbPassword = process.env.DB_PASSWORD;
        if(!this.dbPassword){
            throw new ConnectionOptionsError('Invalid DB_PASSWORD provided in .env.');
        }

        //Call super for Sequelize.
        this._connection = new Sequelize(this.dbName, this.dbUsername, this.dbPassword, {
            host: this.dbHost,
            dialect: this.dbType
        });
        this._connected = false;

        //Init variables.
        this._paperTrail = (paperTrail === undefined) ? true: paperTrail;
    }

    /////////////////////////
    ///////Gets & Sets
    /////////////////////////
    public isConnected(){
        return this._connected;
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public initModel(tableName: string, attributes: ModelAttributes, model: typeof RDBModel){
        let modelName = model.name.replace('Model', '');

        //Initializing model
        model.init(attributes, {
            tableName: tableName,
            modelName: modelName,
            sequelize: this._connection,
            timestamps: this._paperTrail
        });
        model.hooks();
    }
    /////////////////////////
    ///////Connection Management
    /////////////////////////
    public connect(){
        return new Promise<boolean>((resolve, reject) => {
            //Associate models
            // this.models.forEach((model: any) => {
            //     model.associate();
            // });

            //Start Connection.
            this._connection.authenticate()
                .then(() => {
                    this._connected = true; //Connected Flag
                    this.emit(Events.DB_CONNECTED, this);
                    resolve(true);
                }).catch((error) => {
                    this._connected = false; //Connected Flag 
                    if(error instanceof AccessDeniedError){
                        error = new ConnectionOptionsError('Access denied to the database.');
                    }else if(error instanceof ConnectionRefusedError){
                        error =  new ConnectionOptionsError('Connection refused to the database.');
                    }else if(error instanceof HostNotFoundError){
                        error =  new ConnectionOptionsError('Invalid database host.');
                    }else if(error instanceof ConnectionError){
                        error =  new ConnectionOptionsError('Could not connect to the database due to unknown connection issue.');
                    }
                    reject(error);
                });
        });
    }

    public disconnect(){
        return new Promise<boolean>((resolve, reject) => {
            this._connection.close()
                .then(() => {
                    this._connected = false; //Connected Flag
                    this.emit(Events.DB_DISCONNECTED, this);
                    resolve(true);
                }).catch((error) => {
                    reject(error);
                });
        });
    }

    /////////////////////////
    ///////Report
    /////////////////////////
    public getReport(){
        let models = new Array();

        this._connection.modelManager.models.forEach(model => {
            models.push({[model.name]: model.tableName});
        });

        return {
            init: {
                name: this.dbName,
                host: this.dbHost,
                type: this.dbType,
                connected: this._connected
            },
            models: models
        }
    }
}

/////////////////////////
///////Error Classes
/////////////////////////
export class ConnectionOptionsError extends Error {
    constructor(message: string) {
        super(message);
        
        // Saving class name in the property of our custom error as a shortcut.
        this.name = this.constructor.name;
    
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
      }
}