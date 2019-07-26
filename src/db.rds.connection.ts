//Import modules
import {Sequelize, DataTypes, AccessDeniedError, ConnectionRefusedError} from 'sequelize';

//Local Imports
import DockerUtility from './docker.utility';
import RDSModel from './db.rds.model';

export default class RDSConnection {
    //Variables
    private serviceName: string;
    private options: any;
    private ready: boolean = false;
    private connected: boolean = false;

    //Objects
    private sequelize: Sequelize;
    private rdsModels: Array<typeof RDSModel> = new Array<typeof RDSModel>();

    //Default Constructor
    public constructor() {}

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

                //Set ready flag.
                this.ready = true;
            }catch(error){
                if(error.message.includes('Dialect')){
                    throw new InvalidRDSOptions('Invalid Database Dialect provided in .env.');
                }else{
                    throw error; //Pass other errors.
                }
            }
        }else{
            throw new InvalidRDSOptions('Invalid Database Name provided in .env.');
        }
    }

    public initModel(model: typeof RDSModel){
        //Init the model object and push to array of rdsModels.
        const fields = model.fields(DataTypes);
        const sequelize = this.sequelize;
        const modelName = model._modelName();
        const tableName = (this.serviceName + '_' + model._tableName()).toLowerCase();

        //Logging the model before
        console.log('Initiating model: %s(%s)', modelName, tableName);

        //Initializing model
        model.init(fields, {sequelize, tableName, modelName});
        model.hooks();

        //Add to models array
        this.rdsModels.push(model);
    }

    /////////////////////////
    ///////Boolean Functions
    /////////////////////////
    public isReady(){
        return this.ready;
    }

    public isConnected(){
        return this.connected;
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
    public async connect(){
        try{
            //Call associate's from all the models
            this.rdsModels.forEach(rdsModel => {
                //Logging the model before
                console.log('Wiring model: %s', rdsModel.name);

                rdsModel.associate();
            });

            //Calling authenticate
            await this.sequelize.authenticate();

            //Set connected flag.
            this.connected = true;
        
            //Securing sensitive information.
            this.options.username = 'xxxxxxxxxx';
            this.options.password = 'xxxxxxxxxx';

            return {dialect: this.options.dialect, host: this.options.host, name: this.options.name}
        }catch(error){
            if(error instanceof AccessDeniedError){
                throw new InvalidRDSOptions('Invalid Database Credentials provided in .env.');
            }else if(error instanceof ConnectionRefusedError){
                throw new InvalidRDSOptions('Invalid Database Host provided in .env.');
            }else{
                throw error;//Pass other errors.
            }
        }
    }

    public async disconnect(){
        try{
            //Calling Close
            await this.sequelize.close();

            //Set connected flag.
            this.connected = false;

            return {dialect: this.options.dialect, host: this.options.host, name: this.options.name}
        }catch(error){
            throw error;
        }
    }

    public async sync(force: boolean) {
        try{
            //Calling Sync
            await this.sequelize.sync({force});
        }catch(error){
            throw error;
        }
    }
}

/////////////////////////
///////Error Classes
/////////////////////////
export class InvalidRDSOptions extends Error{
    constructor (message: string) {
        super(message);
        
        // Saving class name in the property of our custom error as a shortcut.
        this.name = this.constructor.name;
    
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
      }
}