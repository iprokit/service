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
    private readonly _paperTrail: boolean;
    private _connected: boolean;

    //Connection Objects
    public readonly type: Dialect;
    public readonly host: string;
    public readonly name: string;
    public readonly username: string;
    public readonly password: string;
    private readonly _connection: Sequelize;
    
    //Default Constructor
    public constructor(dialect: Dialect, paperTrail?: boolean){
        //Call super for EventEmitter.
        super();

        //Validate type
        this.type = dialect;
        if(!this.type){
            throw new ConnectionOptionsError('Invalid Database dialect provided.');
        }

        //Validate host
        this.host = process.env.DB_HOST;
        if(!this.host){
            throw new ConnectionOptionsError('Invalid DB_NAME provided in .env.');
        }

        //Validate name
        this.name = process.env.DB_NAME;
        if(!this.name){
            throw new ConnectionOptionsError('Invalid DB_NAME provided in .env.');
        }

        //Validate username
        this.username = process.env.DB_USERNAME;
        if(!this.username){
            throw new ConnectionOptionsError('Invalid DB_USERNAME provided in .env.');
        }

        //Validate password
        this.password = process.env.DB_PASSWORD;
        if(!this.password){
            throw new ConnectionOptionsError('Invalid DB_PASSWORD provided in .env.');
        }

        //Sequelize constructor.
        this._connection = new Sequelize(this.name, this.username, this.password, {
            host: this.host,
            dialect: this.type
        });
        
        //Set default connected.
        this._connected = false;

        //Init variables.
        this._paperTrail = (paperTrail === undefined) ? true : paperTrail;
    }

    /////////////////////////
    ///////Gets & Sets
    /////////////////////////
    public isConnected(){
        return this._connected;
    }

    private getModels(){
        return Object.values(this._connection.models);
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public initModel(modelName: string, tableName: string, attributes: ModelAttributes, model: typeof RDBModel){
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
            //Associate models.
            this.getModels().forEach(model => {
                (model as typeof RDBModel).associate();
            });
            //TODO: Bug - On start when the sub objects are not available this is throwing an error.

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
        //New Models Dict.
        let models: {[name: string]: string} = {};

        this.getModels().forEach(model => {
            models[model.name] = model.tableName;
        });

        return {
            name: this.name,
            host: this.host,
            type: this.type,
            connected: this._connected,
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