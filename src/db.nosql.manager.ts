//Import modules
import Promise from 'bluebird';
import mongoose, { Connection as Mongoose, SchemaDefinition, Schema } from 'mongoose';

//Export Libs
const DataTypes: typeof mongoose.Types = mongoose.Types;
export { mongoose as NoSQL, DataTypes as NoSQLDataTypes };

//Local Imports
import { ClientComponent } from './microservice';
import NoSQLModel from './db.nosql.model';

export default class NoSQLManager implements ClientComponent{
    //NoSQL Variables.
    private _paperTrail: boolean;
    private _connected: boolean;
    
    //Connection Objects
    private _connection: Mongoose;
    
    //Default Constructor
    public constructor(paperTrail?: boolean){
        //Validate host
        let host = process.env.DB_HOST;
        if(!host){
            throw new ConnectionOptionsError('Invalid DB_NAME provided in .env.');
        }

        //Validate name
        let name = process.env.DB_NAME;
        if(!name){
            throw new ConnectionOptionsError('Invalid DB_NAME provided in .env.');
        }

        //Validate username
        let username = process.env.DB_USERNAME;
        if(!username){
            throw new ConnectionOptionsError('Invalid DB_USERNAME provided in .env.');
        }

        //Validate password
        let password = process.env.DB_PASSWORD;
        if(!password){
            throw new ConnectionOptionsError('Invalid DB_PASSWORD provided in .env.');
        }

        //Load Mongoose
        const uri = 'mongodb://' + host;
        const options = {
            dbName: name,
            user: username,
            pass: password,
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

    public getReport(){
        let models = new Array();

        // this.models.forEach(model => {
        //     models.push({[model.name]: model.entityName});
        // });

        return {
            init: {
                name: '$dbName',
                // host: this.host,
                connected: this._connected
            },
            models: models
        }
    }

    /////////////////////////
    ///////Model Functions
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
                this._connected = true; //Connected Flag
                if(!error){
                    resolve(true);
                }else{
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
                    resolve(true);
                });
        });
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