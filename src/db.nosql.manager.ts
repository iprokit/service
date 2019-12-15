//Import modules
import Promise from 'bluebird';
import { EventEmitter } from 'events';
import mongoose, { Connection as Mongoose, SchemaDefinition } from 'mongoose';

//Export Libs
const DataTypes: typeof mongoose.Types = mongoose.Types;
export { mongoose as NoSQL, DataTypes as NoSQLDataTypes };

//Local Imports
import { Client, Events } from './microservice';
import NoSQLModel from './db.nosql.model';

//Export Mongo
export type Mongo = 'mongo';

export default class NoSQLManager extends EventEmitter implements Client {
    //NoSQL Variables.
    private _paperTrail: boolean;
    private _connected: boolean;
    
    //Connection Objects
    public dbType: string;
    public dbHost: string;
    public dbName: string;
    public dbUsername: string;
    public dbPassword: string;
    private _connection: Mongoose;
    
    //Default Constructor
    public constructor(paperTrail?: boolean){
        //Call super for EventEmitter.
        super();

        //Set type
        this.dbType = 'mongo';

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

        //Load Mongoose
        const uri = 'mongodb://' + this.dbHost;
        const options = {
            dbName: this.dbName,
            user: this.dbUsername,
            pass: this.dbPassword,
            useNewUrlParser: true
        }
        this._connection = mongoose.createConnection(uri, options);
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
    public initModel(collectionName: string, attributes: SchemaDefinition, model: typeof NoSQLModel){
        const modelName = model.name.replace('Model', '');

        //Initializing model
        model.init(attributes, {
            collectionName: collectionName,
            modelName: modelName,
            mongoose: this._connection,
            timestamps: this._paperTrail
        });
        model.hooks();
    }

    /////////////////////////
    ///////Connection Management
    /////////////////////////
    public connect(){
        return new Promise<boolean>((resolve, reject) => {
            //Start Connection.
            this._connection.once('connected', (error) => {
                if(!error){
                    this._connected = true; //Connected Flag
                    this.emit(Events.DB_CONNECTED, this);
                    resolve(true);
                }else{
                    this._connected = false; //Connected Flag
                    reject(error);
                }
            });
            this._connection.on('error', (error) => {
                this._connected = false; //Connected Flag
                if(error.message.includes('Authentication failed')){
                    error = new ConnectionOptionsError('Connection refused to the database.');
                }else if(error.message.includes('getaddrinfo ENOTFOUND')){
                    error = new ConnectionOptionsError('Invalid database host.');
                }else if(error.message.includes('connection timed out')){
                    error = new ConnectionOptionsError('Connection timed out to the database.');
                }else{
                    error = error;//Pass other errors.
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
                });
        });
    }

    /////////////////////////
    ///////Report
    /////////////////////////
    public getReport(){
        let models = new Array();

        // this.models.forEach(model => {
        //     models.push({[model.name]: model.entityName});
        // });

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