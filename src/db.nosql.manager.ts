//Import modules
import { EventEmitter } from 'events';
import mongoose, { Connection as Mongoose, SchemaDefinition } from 'mongoose';

//Export Libs
const DataTypes: typeof mongoose.Types = mongoose.Types;
export { Mongoose, DataTypes };

//Local Imports
import { Client, Events, ConnectionState } from './microservice';
import NoSQLModel from './db.nosql.model';

//Export Mongo
export type MongoType = 'mongo';

export default class NoSQLManager extends EventEmitter implements Client {
    //NoSQL Variables.
    private readonly _paperTrail: boolean;
    private _connected: boolean;
    
    //Connection Objects
    public readonly type: MongoType;
    public readonly host: string;
    public readonly name: string;
    public readonly username: string;
    public readonly password: string;
    private readonly _connection: Mongoose;
    
    //Default Constructor
    public constructor(paperTrail?: boolean){
        //Call super for EventEmitter.
        super();

        //Set type
        this.type = 'mongo';

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

        //Mongoose connection.
        this._connection = mongoose.createConnection('mongodb://' + this.host, {
            dbName: this.name,
            user: this.username,
            pass: this.password,
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        //TODO: Bug - UnhandledPromiseRejectionWarning.

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

    public getConnection(){
        return this._connection;
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public initModel(modelName: string, collectionName: string, attributes: SchemaDefinition, model: typeof NoSQLModel){
        //Emit Model event.
        this.emit(Events.DB_ADDED_MODEL, modelName, collectionName, model);

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
    public async connect(){
        return new Promise<ConnectionState>((resolve, reject) => {
            //Start Connection.
            this._connection.once('connected', () => {
                this._connected = true; //Connected Flag
                this.emit(Events.DB_CONNECTED, this);
                resolve(1);
            });
            this._connection.on('error', (error) => {
                this._connected = false; //Connected Flag
                if(error.message.includes('Authentication failed')){
                    error = new ConnectionOptionsError('Connection refused to the database.');
                }else if(error.message.includes('getaddrinfo ENOTFOUND')){
                    error = new ConnectionOptionsError('Invalid database host.');
                }else if(error.message.includes('connection timed out')){
                    error = new ConnectionOptionsError('Connection timed out to the database.');
                }
                reject(error);
            });
        });
    }

    public async disconnect(): Promise<ConnectionState>{
        try{
            await this._connection.close();
            this._connected = false; //Connected Flag
            this.emit(Events.DB_DISCONNECTED, this);
            return 0;
        }catch(error){
            throw error;
        }
    }

    /////////////////////////
    ///////Report
    /////////////////////////
    public getReport(){
        //Models Dict.
        let models: {[name: string]: string} = {};

        this.getModels().forEach(model => {
            models[model.modelName] = model.collection.name;
        });

        return {
            name: this.name,
            host: this.host,
            type: this.type,
            connected: this._connected,
            models: models
        };
    }

    public async sync(force?: boolean){
        //Setting default.
        force = (force === undefined) ? false : force;
        
        try{
            if(force){
                this.getModels().forEach(async model => {
                    const name = model.collection.name;
    
                    try{
                        console.log('EXECUTING: DROP COLLECTION IF EXISTS `%s`;', name);
                        await this._connection.db.dropCollection(name);
                    }catch(error){
                        if(error.code === 26){
                            //Ignore this error.
                        }else{
                            throw error;
                        }
                    }
                });
            }
            this.getModels().forEach(async model => {
                const name = model.collection.name;

                console.log('EXECUTING: CREATE COLLECTION IF NOT EXISTS `%s`;', name);
                await model.createCollection();
            });
            return true;
        }catch(error){
            throw error;
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