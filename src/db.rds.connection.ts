//Import modules
import {Sequelize, DataTypes, AccessDeniedError, ConnectionRefusedError, Dialect} from 'sequelize';

//Local Imports
import FileUtility from './file.utility';
import DockerUtility from './docker.utility';
import RDSModel from './db.rds.model';

//Types: RDSConnectionInitOptions
export type RDSConnectionInitOptions = {
    dialect: Dialect,
    timezone?: string,
    autoWireModels: AutoWireModelOptions
};

//Types: AutoWireModelOptions
export type AutoWireModelOptions = {
    paths?: Array<string>,
    likeName?: string,
    excludes?: Array<string>
};

//Types: RDSConnectionOptions
export type RDSConnectionOptions = {
    name: string,
    username: string,
    password: string,
    host: string,
    dialect: Dialect,
    timezone?: string
}

export default class RDSConnection {
    //Variables
    private serviceName: string;
    private projectPath: string;
    private autoWireOptions: AutoWireModelOptions;
    private options: RDSConnectionOptions;
    private connected: boolean = false;

    //Objects
    private sequelize: Sequelize;
    public readonly models = new Array<typeof RDSModel>();

    //Default Constructor
    public constructor() {}

    /////////////////////////
    ///////Load Functions
    /////////////////////////
    private loadOptions(options: RDSConnectionInitOptions){
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

        //Auto Wire Options
        this.autoWireOptions = options.autoWireModels;
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public init(name: string, projectPath: string, options: RDSConnectionInitOptions){
        this.serviceName = name;
        this.projectPath = projectPath;

        //Load options
        this.loadOptions(options);

        //Setup Sequelize
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

        //Auto Wire Models
        if(this.autoWireOptions !== undefined){
            this.autoWireModels();
        }else{
            throw new InvalidRDSOptions('Invalid auto wire options provided.');
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
    private autoWireModels(){
        const paths = this.autoWireOptions.paths !== undefined ? this.autoWireOptions.paths : ['/'];
        const likeName = this.autoWireOptions.likeName !== undefined ? this.autoWireOptions.likeName : 'model.js';
        const excludes = this.autoWireOptions.excludes !== undefined ? this.autoWireOptions.excludes : [];

        //Adding files to Exclude.
        excludes.push('/node_modules');

        paths.forEach((path: string) => {
            const modelFiles = FileUtility.getFilePaths(this.projectPath + path, likeName, excludes);
            modelFiles.forEach(modelFile => {
                const model: typeof RDSModel = require(modelFile).default;
                this.initModel(model);

                //Add to Array
                this.models.push(model);
            });
        });

        //Associate models
        this.models.forEach(model => {
            this.associateModel(model);
        });
    }

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
        model.validations();
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