//Import modules
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

/**
 * This class is a wrapper around the database `connection`.
 * The underlying connection object is built on `Sequelize` and `Mongoose`.
 * It also manages the database `Model`'s.
 */
export default class DBManager {
    /**
     * Set to true if the paper trail operation should be performed, false otherwise.
     */
    private readonly _paperTrail: boolean;

    /**
     * Set to true if the database is connected, false otherwise.
     */
    private _connected: boolean;

    /**
     * The type of the database.
     */
    public readonly type: Type;

    /**
     * The remote database address, retrieved from `process.env.DB_HOST`.
     */
    public readonly host: string;

    /**
     * The name of the database, retrieved from `process.env.DB_NAME`.
     * 
     * @constant process.env.DB_NAME
     */
    public readonly name: string;

    /**
     * The username of the database, retrieved from `process.env.DB_USERNAME`.
     * 
     * @constant process.env.DB_USERNAME
     */
    public readonly username: string;

    /**
     * The password of the database, retrieved from `process.env.DB_PASSWORD`.
     * 
     * @constant process.env.DB_PASSWORD
     */
    public readonly password: string;

    /**
     * The underlying database `Connection` object.
     */
    private _connection: Connection;

    /**
     * Creates an instance of a `DBManager`.
     * 
     * @param type the type of the database.
     * @param paperTrail the optional, paper trail operation should be performed? true by default.
     * 
     * @throws `ConnectionOptionsError` when a database connection option is invalid.
     */
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

        //Initialize variables.
        this._paperTrail = (paperTrail === undefined) ? true : paperTrail;
    }

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    /**
     * The underlying database `Connection` object.
     */
    public get connection(): Connection {
        return this._connection;
    }

    /**
     * The models under the database `Connection` object.
     */
    public get models() {
        return Object.values(this._connection.models);
    }

    /**
     * Set to true if the database is connected, false otherwise.
     */
    public get connected() {
        return this._connected;
    }

    /**
     * True if the database is `noSQL` type.
     */
    public get noSQL() {
        return this.type === 'mongo';
    }

    /**
     * True if the database is `SQL` type.
     */
    public get rdb() {
        return !this.noSQL;
    }

    //////////////////////////////
    //////Init
    //////////////////////////////
    /**
     * Initialize the database `Connection` object.
     */
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

    /**
     * Initialize the `Model` instance.
     * 
     * @param modelName the name of the model.
     * @param entityName the entity name of the model, i.e : collectionName/tableName.
     * @param attributes the entity attributes.
     * @param model the model instance.
     */
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

    //////////////////////////////
    //////Connection Management
    //////////////////////////////
    /**
     * Connect to the database.
     * 
     * @param callback optional callback. Will be called when the database is connected.
     */
    public connect(callback?: (error?: Error) => void) {
        if (this.noSQL) { //NoSQL Connection
            this.connectNoSQL((error) => {
                if (callback) {
                    callback(error);
                }
            });
        } else { //RDB Connection.
            this.connectRDB((error) => {
                if (callback) {
                    callback(error);
                }
            });
        }
    }

    /**
     * Connect to NoSQL database.
     * 
     * @param callback optional callback. Will be called when the database is connected.
     */
    private connectNoSQL(callback?: (error?: Error) => void) {
        //Start Connection.
        (this._connection as NoSQL).once('connected', () => {
            //Set connected Flag 
            this._connected = true;

            //Callback.
            if (callback) {
                callback();
            }
        });
        (this._connection as NoSQL).on('error', (error: Error) => {
            //Set connected Flag 
            this._connected = false;

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

            //Callback with error.
            if (callback) {
                callback(error);
            }
        });
    }

    /**
     * Connect to RDB database.
     * 
     * `model.associate()` is called on all the models before the connection.
     * 
     * @param callback optional callback. Will be called when the database is connected.
     */
    private connectRDB(callback?: (error?: Error) => void) {
        //Associate models.
        try {
            this.models.map(model => (model as typeof RDBModel).associate());
        } catch (error) {
            console.error(error);
        }

        //Start Connection.
        (this._connection as RDB).authenticate()
            .then(() => {
                //Set connected Flag 
                this._connected = true;

                //Callback.
                if (callback) {
                    callback();
                }
            }).catch((error: Error) => {
                //Set connected Flag 
                this._connected = false;

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

                //Callback with error.
                if (callback) {
                    callback(error);
                }
            });
    }

    /**
     * Disconnect from the database.
     * 
     * @param callback optional callback. Will be called when the database is disconnected.
     */
    public disconnect(callback?: (error?: Error) => void) {
        this._connection.close()
            .then(() => {
                //Set connected Flag 
                this._connected = false;

                //Callback.
                if (callback) {
                    callback();
                }
            }).catch((error: Error) => {
                //Callback with error.
                if (callback) {
                    callback(error);
                }
            });
    }

    //////////////////////////////
    //////Sync
    //////////////////////////////
    /**
     * Performs asynchronous, sync operation on the database.
     * 
     * @param force the optional, sync operation should be forced? false by default.
     */
    public async sync(force?: boolean) {
        /**
         * Performs asynchronous, sync operation on noSQL database.
         * 
         * @function
         */
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

        /**
         * Performs asynchronous, sync operation on RDB database.
         * 
         * @function
         */
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

//////////////////////////////
//////Type Definitions
//////////////////////////////
/**
 * The type definitions of the Connection.
 * 
 * @type `RDB` Sequelize connection.
 * @type `NoSQL` Mongoose connection.
 */
export declare type Connection = RDB | NoSQL;

/**
 * The type definitions of the Database type.
 * 
 * @type `mongo` mongo DB.
 * @type `mysql` mysql DB.
 * @type `postgres` postgres DB.
 * @type `sqlite` sqlite DB.
 * @type `mariadb` mariadb DB.
 * @type `mssql` mssql DB.
 */
export declare type Type = 'mongo' | Dialect;

/**
 * The type definitions of the Database `Model` type.
 * 
 * @type `RDBModel` RDB(Sequelize) Model.
 * @type `NoSQLModel` NoSQL(Mongoose) Model.
 */
export declare type Model = typeof RDBModel | typeof NoSQLModel;

/**
 * The type definitions for RDB Model Attributes.
 */
export declare type RDBModelAttributes = SequelizeModelAttributes;

/**
 * The type definitions for noSQL Model Attributes.
 */
export declare type NoSQLModelAttributes = SchemaDefinition;

/**
 * The type definitions for ModelAttributes.
 * 
 * @type `RDBModelAttributes` RDB(Sequelize) Model Attributes.
 * @type `NoSQLModelAttributes` NoSQL(Mongoose) Model Attributes.
 * 
 */
export declare type ModelAttributes = RDBModelAttributes | NoSQLModelAttributes;

//////////////////////////////
//////ConnectionOptionsError
//////////////////////////////
/**
 * ErrorReply is an instance of Error. Thrown when a database connection option is invalid.
 */
export class ConnectionOptionsError extends Error {
    constructor(message: string) {
        super(message);

        // Saving class name in the property of our custom error as a shortcut.
        this.name = this.constructor.name;

        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
    }
}