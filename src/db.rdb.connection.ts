//Import modules
import {Sequelize, DataTypes, AccessDeniedError, ConnectionRefusedError, Dialect} from 'sequelize';

//Local Imports
import {DBConnectionOptions} from './db.manager';
import RDBModel from './db.rdb.model';

//Types: RDBOptions
export type RDBOptions = {
    dialect: Dialect,
    timezone?: string
};

export default class RDBConnection {
    //Sequelize variables.
    private sequelize: Sequelize;

    //Options.
    private connectionOptions: DBConnectionOptions;
    private rdbOptions: RDBOptions;

    //Default Constructor
    public constructor(connectionOptions: DBConnectionOptions, rdbOptions: RDBOptions) {
        this.connectionOptions = connectionOptions;
        this.rdbOptions = rdbOptions;

        rdbOptions.timezone = rdbOptions.timezone || '+00:00';
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public init(){
        //Setup Sequelize
        if(this.connectionOptions.name !== undefined){
            try{
                this.sequelize = new Sequelize(this.connectionOptions.name, this.connectionOptions.username, this.connectionOptions.password, {
                    host: this.connectionOptions.host,
                    dialect: this.rdbOptions.dialect,
                    timezone: this.rdbOptions.timezone
                });
            }catch(error){
                if(error.message.includes('Dialect')){
                    throw new InvalidRDBOptions('Invalid Database Dialect provided.');
                }else{
                    throw error; //Pass other errors.
                }
            }
        }else{
            throw new InvalidRDBOptions('Invalid Database Name provided in .env.');
        }
    }

    /////////////////////////
    ///////Sequelize Functions
    /////////////////////////
    public connect(){
        return new Promise((resolve, reject) => {
            this.sequelize.authenticate()
                .then(() => {
                    resolve(true);
                }).catch((error) => {
                    if(error instanceof AccessDeniedError){
                        reject(new InvalidRDBOptions('Invalid Database Credentials provided in .env.'));
                    }else if(error instanceof ConnectionRefusedError){
                        reject(new InvalidRDBOptions('Invalid Database Host provided in .env.'));
                    }else{
                        reject(error);//Pass other errors.
                    }
                });
        });
    }

    public disconnect(){
        return new Promise((resolve, reject) => {
            this.sequelize.close()
                .then(() => {
                    resolve(true);
                }).catch((error) => {
                    reject(error);//Pass other errors.
                });
        });
    }

    public sync(force: boolean) {
        return new Promise((resolve, reject) => {
            this.sequelize.sync({force})
                .then(() => {
                    resolve();
                }).catch((error) => {
                    reject(error);//Pass other errors.
                });
        });
    }

    /////////////////////////
    ///////Model Functions
    /////////////////////////
    public initModel(model: typeof RDBModel){
        //Init the model object and push to array of rdbModels.
        const fields = model.fields(DataTypes);
        const sequelize = this.sequelize;
        const modelName = model._modelName();
        const tableName = (global.service.name + '_' + model._tableName()).toLowerCase();

        //Logging the model before
        console.log('Initiating model: %s(%s)', modelName, tableName);

        //Initializing model + adding hooks
        model.init(fields, {sequelize, tableName, modelName});
        model.hooks();
        model.validations();
    }

    public associateModel(model: typeof RDBModel){
        //Logging the model before
        console.log('Associating model: %s', model.name);

        //Associating model
        model.associate();
    }
}

/////////////////////////
///////Error Classes
/////////////////////////
export class InvalidRDBOptions extends Error{
    constructor (message: string) {
        super(message);
        
        // Saving class name in the property of our custom error as a shortcut.
        this.name = this.constructor.name;
    
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
      }
}