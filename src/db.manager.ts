//Import modules
import EventEmitter from 'events';
import { Sequelize as RDB, Dialect, Op as RDBOp, AccessDeniedError, ConnectionRefusedError, HostNotFoundError, ConnectionError } from 'sequelize';
import { ModelAttributes as SequelizeModelAttributes, DataTypes as RDBDataTypes } from 'sequelize';
import mongoose, { Connection as NoSQL, SchemaDefinition } from 'mongoose';

//Export Libs
const NoSQLDataTypes: typeof mongoose.Types = mongoose.Types;
export { NoSQL, NoSQLDataTypes };
export { RDB, RDBOp, RDBDataTypes };

//Local Imports
import RDBModel from './db.rdb.model';
import NoSQLModel from './db.nosql.model';

//Export Types
export declare type Connection = RDB | NoSQL;
export declare type Type = 'mongo' | Dialect;
export declare type Model = typeof RDBModel | typeof NoSQLModel;
export declare type RDBModelAttributes = SequelizeModelAttributes;
export declare type NoSQLModelAttributes = SchemaDefinition;
export declare type ModelAttributes = RDBModelAttributes | NoSQLModelAttributes;

export default class DBManager {
    //DBManager Variables.
    private readonly _paperTrail: boolean;
    private _connected: boolean;

    //Connection Objects
    public readonly type: Type;
    public readonly host: string;
    public readonly name: string;
    public readonly username: string;
    public readonly password: string;

    //Connection
    private _connection: Connection;

    //Default Constructor
    public constructor(type: Type, paperTrail?: boolean) {
        //Validate type
        this.type = type;
        if (!this.type) {
            throw new ConnectionOptionsError('Invalid Database type provided.');
        }

        //Validate host
        this.host = process.env.DB_HOST;
        if (!this.host) {
            throw new ConnectionOptionsError('Invalid DB_NAME provided in .env.');
        }

        //Validate name
        this.name = process.env.DB_NAME;
        if (!this.name) {
            throw new ConnectionOptionsError('Invalid DB_NAME provided in .env.');
        }

        //Validate username
        this.username = process.env.DB_USERNAME;
        if (!this.username) {
            throw new ConnectionOptionsError('Invalid DB_USERNAME provided in .env.');
        }

        //Validate password
        this.password = process.env.DB_PASSWORD;
        if (!this.password) {
            throw new ConnectionOptionsError('Invalid DB_PASSWORD provided in .env.');
        }

        //Set default connected.
        this._connected = false;

        //Init variables.
        this._paperTrail = (paperTrail === undefined) ? true : paperTrail;
    }

    /////////////////////////
    ///////Gets & Sets
    /////////////////////////
    public get connection(): Connection {
        return this._connection;
    }

    private get models() {
        return Object.values(this._connection.models);
    }

    public get connected() {
        return this._connected;
    }

    public get noSQL() {
        return this.type === 'mongo';
    }

    public get rdb() {
        return !this.noSQL;
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public init() {
        if (this.noSQL) {
            //Mongoose connection.
            this._connection = mongoose.createConnection('mongodb://' + this.host, {
                dbName: this.name,
                user: this.username,
                pass: this.password,
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            //TODO: Bug - unhandledRejection when incorrect details are passed.
        } else {
            //Sequelize constructor.
            this._connection = new RDB(this.name, this.username, this.password, {
                host: this.host,
                dialect: (this.type as Dialect)
            });
        }
    }

    public initModel(modelName: string, entityName: string, attributes: ModelAttributes, model: Model) {
        if (this.noSQL) {
            //Initializing NoSQL model
            (model as typeof NoSQLModel).init((attributes as NoSQLModelAttributes), {
                collectionName: entityName,
                modelName: modelName,
                mongoose: (this._connection as NoSQL),
                timestamps: this._paperTrail
            });
        } else {
            //Initializing RDB model
            (model as typeof RDBModel).init((attributes as RDBModelAttributes), {
                tableName: entityName,
                modelName: modelName,
                sequelize: (this._connection as RDB),
                timestamps: this._paperTrail
            });
        }

        //Call Hooks.
        model.hooks();
    }

    /////////////////////////
    ///////Connection Management
    /////////////////////////
    public async connect(callback: () => void) {
        //Sub function to connect.
        const _noSQLConnection = async () => {
            return new Promise<void>((resolve, reject) => {
                //Start Connection.
                (this._connection as NoSQL).once('connected', () => resolve());
                (this._connection as NoSQL).on('error', (error) => reject(error));
            });
        }

        const _RDBConnection = async () => {
            //Associate models.
            try {
                this.models.map(model => (model as typeof RDBModel).associate());
            } catch (error) {
                console.error(error);
            }

            //Start Connection.
            return await (this._connection as RDB).authenticate();
        }

        try {
            if (this.noSQL) {
                await _noSQLConnection();
            } else {
                await _RDBConnection();
            }

            //Connection established.
            this._connected = true; //Connected Flag
            return 1;
        } catch (error) {
            this._connected = false; //Connected Flag 

            //SQL Errors.
            if (error instanceof AccessDeniedError) {
                error = new ConnectionOptionsError('Access denied to the database.');
            }
            if (error instanceof ConnectionRefusedError) {
                error = new ConnectionOptionsError('Connection refused to the database.');
            }
            if (error instanceof HostNotFoundError) {
                error = new ConnectionOptionsError('Invalid database host.');
            }
            if (error instanceof ConnectionError) {
                error = new ConnectionOptionsError('Could not connect to the database due to unknown connection issue.');
            }

            //NoSQL Errors.
            if (error.message.includes('Authentication failed')) {
                error = new ConnectionOptionsError('Connection refused to the database.');
            }
            if (error.message.includes('getaddrinfo ENOTFOUND')) {
                error = new ConnectionOptionsError('Invalid database host.');
            }
            if (error.message.includes('connection timed out')) {
                error = new ConnectionOptionsError('Connection timed out to the database.');
            }

            throw error;
        }
    }

    public async disconnect(callback: () => void) {
        try {
            await this._connection.close();
            this._connected = false; //Connected Flag
            return 0;
        } catch (error) {
            throw error;
        }
    }

    /////////////////////////
    ///////Report
    /////////////////////////
    public getReport() {
        //New Models Dict.
        let models: { [name: string]: string } = {};

        //Gets models.
        if (this.noSQL) {
            this.models.forEach(model => models[model.name] = model.collection.name);
        } else {
            this.models.forEach(model => models[model.name] = model.tableName);
        }

        return {
            name: this.name,
            host: this.host,
            type: this.type,
            connected: this._connected,
            models: models
        }
    }

    public async sync(force?: boolean) {
        //Sub function to sync.
        const _noSQLSync = async () => {
            this.models.forEach(async model => {
                const name = model.collection.name;

                try {
                    if (force) {
                        console.log('EXECUTING: DROP COLLECTION IF EXISTS `%s`;', name);
                        await (this._connection as NoSQL).db.dropCollection(name);
                    }
                    console.log('EXECUTING: CREATE COLLECTION IF NOT EXISTS `%s`;', name);
                    await model.createCollection();
                } catch (error) {
                    if (error.code === 26) {
                        //Ignore this error since the collection does not exist.
                    } else {
                        throw error;
                    }
                }
            });
        }

        const _rdbSync = async () => {
            await (this._connection as RDB).sync({ force: force });
        }

        //Setting default.
        force = (force === undefined) ? false : force;

        try {
            //Call DB Sync
            if (this.noSQL) {
                await _noSQLSync();
            } else {
                await _rdbSync();
            }
            return true;
        } catch (error) {
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