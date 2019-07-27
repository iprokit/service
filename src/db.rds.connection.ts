//Import modules
import {Sequelize, DataTypes, AccessDeniedError, ConnectionRefusedError, Dialect} from 'sequelize';

//Local Imports
import FileUtility from './file.utility';
import DockerUtility from './docker.utility';
import RDSModel from './db.rds.model';

export default class RDSConnection {
    //Variables
    private serviceName: string;
    private options: any;
    private connected: boolean = false;

    //Objects
    private sequelize: Sequelize;
    private rdsModels: Array<typeof RDSModel> = new Array<typeof RDSModel>();

    //Default Constructor
    public constructor(name: string, options: any) {
        this.serviceName = name;

        //Load options
        this.loadOptions(options);

        //Init sequelize
        this.init();

        //TODO: Continue from here..
        //this.wireModels(options.autoWireModels);
    }

    /////////////////////////
    ///////Load Functions
    /////////////////////////
    private loadOptions(options: any){
        //Try loading options from process.env
        this.options = {
            name: process.env.DB_NAME,
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            host: process.env.DB_HOST,
            dialect: options.dialect,
            timezone: options.timezone
        };

        //Loading default options
        this.options.host = this.options.host !== undefined ? this.options.host: DockerUtility.getHostIP();
        this.options.timezone = this.options.timezone !== undefined ? this.options.timezone: '+00:00';
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    private init(){
        if(this.options.name !== undefined){
            try{
                this.sequelize = new Sequelize(this.options.name, this.options.username, this.options.password, {
                    host: this.options.host,
                    dialect: this.options.dialect,
                    timezone: this.options.timezone
                });
            }catch(error){
                if(error.message.includes('Dialect')){
                    throw new InvalidRDSOptions('Invalid Database Dialect provided.');
                }else{
                    throw error; //Pass other errors.
                }
            }
        }else{
            throw new InvalidRDSOptions('Invalid Database Name provided in .env.');
        }
    }

    /////////////////////////
    ///////Boolean Functions
    /////////////////////////
    public isConnected(){
        return this.connected;
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
        return new Promise((resolve, reject) => {
            this.sequelize.authenticate()
                .then(() => {
                    //Set connected flag.
                    this.connected = true;
                
                    //Securing sensitive information.
                    this.options.username = 'xxxxxxxxxx';
                    this.options.password = 'xxxxxxxxxx';

                    resolve({dialect: this.options.dialect, host: this.options.host, name: this.options.name});
                }).catch((error) => {
                    if(error instanceof AccessDeniedError){
                        reject(new InvalidRDSOptions('Invalid Database Credentials provided in .env.'));
                    }else if(error instanceof ConnectionRefusedError){
                        reject(new InvalidRDSOptions('Invalid Database Host provided in .env.'));
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
                    //Set connected flag.
                    this.connected = false;
        
                    resolve({dialect: this.options.dialect, host: this.options.host, name: this.options.name});
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
    private wireModels(wireOptions?: Array<any>){
        wireOptions.forEach(wireOption => {
            const rootPath = wireOption.rootPath !== undefined ? wireOption.rootPath : './';
            const likeName = wireOption.likeName !== undefined ? wireOption.likeName : 'model.js';

            let modelPaths = FileUtility.getFilePaths(rootPath, likeName); 
            modelPaths.forEach(modelPath => {
                const model: typeof RDSModel = require(process.cwd() + modelPath).default;
                this.initModel(model);

                //Add to Array
                this.rdsModels.push(model);       
            });
        });
    }

    // private addModel(model: typeof RDSModel){
    //     this.rdsModels.push(model);
    // }

    // private wireModels(){
    //     //Initialize models first
    //     this.rdsModels.forEach(rdsModel => {
    //         this.initModel(rdsModel);
    //     });

    //     //Associate models
    //     this.rdsModels.forEach(rdsModel => {
    //         this.associateModel(rdsModel);
    //     });
    // }

    private initModel(model: typeof RDSModel){
        //Init the model object and push to array of rdsModels.
        const fields = model.fields(DataTypes);
        const sequelize = this.sequelize;
        const modelName = model._modelName();
        const tableName = (this.serviceName + '_' + model._tableName()).toLowerCase();

        //Logging the model before
        console.log('Initiating model: %s(%s)', modelName, tableName);

        //Initializing model + adding hooks
        model.init(fields, {sequelize, tableName, modelName});
        model.hooks();
    }

    private associateModel(model: typeof RDSModel){
        //Logging the model before
        console.log('Associating model: %s', model.name);

        //Associating model
        model.associate();
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