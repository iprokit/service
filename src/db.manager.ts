//Local Imports
import DockerUtility from './docker.utility';
import FileUtility from './file.utility';
import RDBConnection, {InvalidRDBOptions} from './db.rdb.connection';
import RDBModel from './db.rdb.model';

//Types: DBConnectionOptions
export type DBConnectionOptions = {
    name: string,
    username: string,
    password: string,
    host: string
}

//Types: DBInitOptions
export type DBInitOptions = {
    type: typeof MY_SQL | typeof NoSQL,
    timezone?: string,
    autoWireModels: AutoWireOptions
};

//Types: AutoWireOptions
export type AutoWireOptions = {
    paths?: Array<string>,
    likeName?: string,
    excludes?: Array<string>
};

//DB variable types.
const MY_SQL = 'mysql';
const NoSQL = 'mongo';

export default class DBManager{
    //Options
    private dbConnectionOptions: DBConnectionOptions;
    
    //Connection Objects
    private db: RDBConnection;

    //Models
    private models = new Array<typeof RDBModel>();
    
    //Default Constructor
    public constructor(){
        this.loadOptions();
    }

    /////////////////////////
    ///////Load Functions
    /////////////////////////
    private loadOptions(){
        //Try loading options from process.env
        this.dbConnectionOptions = {
            name: process.env.DB_NAME,
            username: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            host: process.env.DB_HOST || DockerUtility.getHostIP()
        };
    }
    
    public init(initOptions: DBInitOptions){
        switch(initOptions.type){
            case MY_SQL:
                //Setup MySQL.
                const rdbOptions = {
                    dialect: initOptions.type,
                    timezone: initOptions.timezone
                }
                this.db = new RDBConnection(this.dbConnectionOptions, rdbOptions);

                //try Init db
                try{
                    this.db.init();
                }catch(error){
                    if(error instanceof InvalidRDBOptions){
                        throw new InvalidConnectionOptions(error.message);
                    }else{
                        throw error;
                    }
                }

                //Auto Wire Models
                if(initOptions.autoWireModels !== undefined){
                    this.autoWireModels(initOptions.autoWireModels);
                }else{
                    throw new InvalidDBInitOptions('Invalid DB autoWireModels provided.');
                }
                break;
            case NoSQL:
                console.log('Mongo to be implemented.');
                break;
            default:
                throw new InvalidDBInitOptions('Invalid DB type provided.')
        }
    }

    public connect(){
        return new Promise((resolve, reject) => {
            if(this.db !== undefined){
                this.db.connect()
                .then((connection) => {
                    resolve(connection)
                })
                .catch((error: any) => {
                    if(error instanceof InvalidRDBOptions){
                        reject(new InvalidConnectionOptions(error.message))
                    }else{
                        reject(error);//Pass other errors.
                    }
                });
            }
        });
    }

    public disconnect(){
        return new Promise((resolve, reject) => {
            if(this.db !== undefined){
                this.db.disconnect()
                    .then((disconnected) => {
                        resolve(disconnected);
                    }).catch((error) => {
                        reject(error);//Pass other errors.
                    });
            }
        });
    }

    /////////////////////////
    ///////Model Functions
    /////////////////////////
    private autoWireModels(autoWireModels: AutoWireOptions){
        const paths = autoWireModels.paths || ['/'];
        const likeName = autoWireModels.likeName || 'model.js';
        const excludes = autoWireModels.excludes || [];

        //Adding files to Exclude.
        excludes.push('/node_modules');

        paths.forEach((path: string) => {
            const modelFiles = FileUtility.getFilePaths(path, likeName, excludes);
            modelFiles.forEach(modelFile => {
                const model = require(modelFile).default;

                //Try initializing the model.
                try{
                    this.db.initModel(model);
                }catch(error){
                    console.error('Could not auto wire model: %s', model.name);
                }

                //Add to Array
                this.models.push(model);
            });
        });

        //Associate models
        this.models.forEach(model => {
            this.db.associateModel(model);
        });
    }

    // private createRDSEndpoints(){
    //     //Sudo objects to pass into promise. As this keyword is not available.
    //     const rds = this.rds;

    //     this.post('/database/sync', (request: Request, response: Response) => {
    //         rds.sync(request.body.force)
    //             .then(() => {
    //                 response.status(httpStatus.OK).send({status: true, message: 'Database & tables synced!'});
    //             })
    //             .catch((error: any) => {
    //                 response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
    //             });
    //     });
    // }
}

/////////////////////////
///////Error Classes
/////////////////////////
export class InvalidConnectionOptions extends Error{
    constructor (message: string) {
        super(message);
        
        // Saving class name in the property of our custom error as a shortcut.
        this.name = this.constructor.name;
    
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
      }
}

export class InvalidDBInitOptions extends Error{
    constructor (message: string) {
        super(message);
        
        // Saving class name in the property of our custom error as a shortcut.
        this.name = this.constructor.name;
    
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
      }
}