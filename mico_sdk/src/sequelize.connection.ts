//Import modules
import {Sequelize, DataTypes, AccessDeniedError, ConnectionRefusedError} from 'sequelize';

//Local Imports
import DockerUtility from './docker.utility';
import SequelizeModel from './sequelize.model';

export default class SequelizeConnection {
    //Sequelize variables
    private serviceName: string;
    private options: any;
    private ready: boolean = false;

    //Sequelize objects
    private sequelize: Sequelize;
    private sequelizeModels: Array<typeof SequelizeModel> = new Array<typeof SequelizeModel>();

    //Default Constructor
    public constructor() {
        //Do Nothing
    }

    /////////////////////////
    ///////Load Functions
    /////////////////////////
    private loadOptions(){
        //Try loading options from process.env
        this.options = {
            name: process.env.DB_NAME,
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            host: process.env.DB_HOST,
            dialect: process.env.DB_TYPE,
            timezone: process.env.DB_TIMEZONE
        };

        //Loading default options
        this.options.host = this.options.host !== undefined ? this.options.host: DockerUtility.getHostIP();
        this.options.timezone = this.options.timezone !== undefined ? this.options.timezone: '+00:00';
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public init(name: string){
        this.serviceName = name;

        //Load options
        this.loadOptions();

        if(this.options.name !== undefined){
            try{
                this.sequelize = new Sequelize(this.options.name, this.options.username, this.options.password, {
                    host: this.options.host,
                    dialect: this.options.dialect,
                    timezone: this.options.timezone
                });
        
                //Securing sensitive information.
                this.options.username = 'xxxxxxxxxx';
                this.options.password = 'xxxxxxxxxx';

                //Set ready flag.
                this.ready = true;
            }catch(error){
                if(error.message.includes('Dialect')){
                    throw new InvalidSequelizeOptions('Invalid Database Dialect provided in .env.');
                }else{
                    throw new Error(error); //Pass other errors.
                }
            }
        }else{
            throw new InvalidSequelizeOptions('Invalid Database Name provided in .env.');
        }
    }

    public initModel(model: typeof SequelizeModel){
        //Init the model object and push to array of sequelizeModels.
        const fields = model.fields(DataTypes);
        const sequelize = this.sequelize;
        const modelName = model._modelName();
        const tableName = (this.serviceName + '_' + model._tableName()).toLowerCase();

        model.init(fields, {sequelize, tableName, modelName});
        this.sequelizeModels.push(model);
    }

    /////////////////////////
    ///////Boolean Functions
    /////////////////////////
    public isReady(){
        return this.ready;
    }

    public hasOptions(){
        if(process.env.DB_NAME === undefined && process.env.DB_USERNAME === undefined && process.env.DB_PASSWORD === undefined
            && process.env.DB_HOST === undefined && process.env.DB_TYPE === undefined && process.env.DB_TIMEZONE === undefined){
            return false;//No options were loaded.
        }else{
            return true;//Options were loaded.
        }
    }

    /////////////////////////
    ///////Get/Sets Functions
    /////////////////////////
    public getOptions(){
        return this.options;
    }

    /////////////////////////
    ///////Sequelize Functions
    /////////////////////////
    public connect(){
        //Sudo objects to pass into promise. As this keyword is not available.
        const sequelize = this.sequelize;
        const dialect = this.options.dialect;
        const host = this.options.host;
        const name = this.options.name;

        //Call associate's from all the models
        this.sequelizeModels.forEach(sequelizeModel => {
            sequelizeModel.associate();
        });

        //Calling authenticate
        return new Promise(function(resolve, reject){
            sequelize.authenticate()
            .then(() => {
                resolve({name, host, dialect});
            })
            .catch((error: any) => {
                if(error instanceof AccessDeniedError){
                    reject(new InvalidSequelizeOptions('Invalid Database Credentials provided in .env.'));
                }else if(error instanceof ConnectionRefusedError){
                    reject(new InvalidSequelizeOptions('Invalid Database Host provided in .env.'));
                }else{
                    reject(new Error(error));//Pass other errors.
                }
            });
        });
    }

    public disconnect(){
        //Sudo objects to pass into promise. As this keyword is not available.
        const sequelize = this.sequelize;
        const dialect = this.options.dialect;
        const host = this.options.host;
        const name = this.options.name;

        return new Promise(function(resolve, reject){
            sequelize.close()
            .then(() => {
                resolve({name, host, dialect});
            })
            .catch((error: any) => {
                reject(new Error(error));
            });
        });
    }

    public sync(force: boolean) {
        //Sudo objects to pass into promise. As this keyword is not available.
        const sequelize = this.sequelize;
        
        return new Promise(function(resolve, reject){
            sequelize.sync({force})
            .then(() => {
                resolve();
            })
            .catch((error: any) => {
                reject(new Error(error));
            });
        });
    }
}

/////////////////////////
///////Error Classes
/////////////////////////
export class InvalidSequelizeOptions extends Error{
    constructor (message: string) {
        super(message);
        
        // Saving class name in the property of our custom error as a shortcut.
        this.name = this.constructor.name;
    
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
      }
}