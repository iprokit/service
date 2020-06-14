//Import modules
import { Sequelize as RDB, Dialect, AccessDeniedError, ConnectionRefusedError, HostNotFoundError, ConnectionError } from 'sequelize';
import mongoose, { Connection as NoSQL } from 'mongoose';
import { Logger } from 'winston';
import { EventEmitter } from 'events';

//Local Imports
import RDBModel, { RDBModelAttributes } from './db.rdb.model';
import NoSQLModel, { NoSQLModelAttributes } from './db.nosql.model';

//Export Libs
export { RDB }
export { NoSQL }

/**
 * This class is a wrapper around the database `connection`.
 * The underlying connection object is built on `Sequelize` and `Mongoose`.
 * It also manages the database `Model`'s.
 * 
 * @emits `connected` when the database is connected.
 * @emits `disconnected` when the database is disconnected.
 */
export default class DBManager extends EventEmitter {
    /**
     * The name of the database.
     */
    public readonly name: string;

    /**
     * The type of the database.
     */
    public readonly type: Type;

    /**
     * The remote database address.
     */
    public readonly host: string;

    /**
     * The username of the database.
     */
    public readonly username: string;

    /**
     * The password of the database.
     */
    public readonly password: string;

    /**
     * True if the paper trail operation should be performed, false otherwise.
     */
    public readonly paperTrail: boolean;

    /**
     * Set to true if the database is connected, false otherwise.
     */
    private _connected: boolean;

    /**
     * The underlying database `Connection` object.
     */
    public readonly connection: Connection;

    /**
     * The logger instance.
     */
    public readonly logger: Logger;

    /**
     * Creates an instance of a `DBManager`.
     * 
     * @param logger the logger instance.
     * @param options the optional, constructor options.
     * 
     * @throws `ConnectionOptionsError` when a database connection option is invalid.
     */
    constructor(logger: Logger, options?: Options) {
        //Call super for EventEmitter.
        super();

        //Initialize variables.
        this.logger = logger;

        //Initialize options if any.
        if(options) {
            //Validate type
            this.type = options.type;
            if (!this.type) {
                throw new ConnectionOptionsError('Invalid database type provided.');
            }
    
            //Validate host
            this.host = options.host;
            if (!this.host) {
                throw new ConnectionOptionsError('Invalid database host provided.');
            }
    
            //Validate name
            this.name = options.name;
            if (!this.name) {
                throw new ConnectionOptionsError('Invalid database name provided.');
            }
    
            //Validate username
            this.username = options.username;
            if (!this.username) {
                throw new ConnectionOptionsError('Invalid database username provided.');
            }
    
            //Validate password
            this.password = options.password;
            if (!this.password) {
                throw new ConnectionOptionsError('Invalid database password provided.');
            }

            this.paperTrail = (options.paperTrail === undefined) ? true : options.paperTrail;
    
            //Initialize NoSQL connection object.
            if (this.noSQL) {
                //Mongoose connection.
                this.connection = mongoose.createConnection(`mongodb://${this.host}`, {
                    dbName: this.name,
                    user: this.username,
                    pass: this.password,
                    useNewUrlParser: true,
                    useUnifiedTopology: true
                });
                mongoose.set('debug', (collectionName: string, method: string, query: string, doc: string) => {
                    this.logger.info(`Executing: ${method} ${collectionName}: ${JSON.stringify(query)}`);
                });
                //TODO: https://iprotechs.atlassian.net/browse/PMICRO-17
            }
    
            //Initialize RDB connection object.
            if (this.rdb) {
                //Sequelize constructor.
                this.connection = new RDB(this.name, this.username, this.password, {
                    host: this.host,
                    dialect: (this.type as Dialect),
                    logging: (sql: string) => {
                        this.logger.info(sql);
                    }
                });
            }
        }

        //Set default connected.
        this._connected = false;
    }

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
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
        return this.type === 'mysql' || this.type === 'postgres' || this.type === 'sqlite' || this.type === 'mariadb' || this.type === 'mssql';
    }

    /**
     * Set to true if the database is connected, false otherwise.
     */
    public get connected() {
        return this._connected;
    }

    /**
     * The models under the database `Connection`.
     */
    public get models() {
        return Object.values(this.connection.models);
    }

    //////////////////////////////
    //////Init
    //////////////////////////////
    /**
     * Initialize the `Model` instance.
     * 
     * @param modelName the name of the model.
     * @param entityName the entity name of the model, i.e : collectionName/tableName.
     * @param attributes the entity attributes.
     * @param model the model instance.
     * 
     * @throws ModelError when database `Connection` type and `Model` type do not match.
     */
    public initModel(modelName: string, entityName: string, attributes: ModelAttributes, model: Model) {
        if (this.noSQL && model.prototype instanceof NoSQLModel) {
            //Initializing NoSQL model
            (model as typeof NoSQLModel).init((attributes as NoSQLModelAttributes), {
                collectionName: entityName,
                modelName: modelName,
                mongoose: (this.connection as NoSQL),
                timestamps: this.paperTrail
            });

            //Call Hooks.
            model.hooks();
        } else if (this.rdb && model.prototype instanceof RDBModel) {
            //Initializing RDB model
            (model as typeof RDBModel).init((attributes as RDBModelAttributes), {
                tableName: entityName,
                modelName: modelName,
                sequelize: (this.connection as RDB),
                timestamps: this.paperTrail
            });

            //Call Hooks.
            model.hooks();
        } else {
            throw new ModelError(`Database connection type and model type mismatched for ${modelName}`);
        }
    }

    //////////////////////////////
    //////Connection Management
    //////////////////////////////
    /**
     * Connect to the database.
     * 
     * @param callback optional callback. Will be called when the database is connected.
     */
    public connect(callback?: (connection: boolean, error?: Error) => void) {
        //NoSQL Connection
        if (this.noSQL) {
            this.connectNoSQL((error) => {
                //Callback.
                if (callback) {
                    callback(true, error);
                }
            });
        }

        //RDB Connection.
        if (this.rdb) {
            this.connectRDB((error) => {
                //Callback.
                if (callback) {
                    callback(true, error);
                }
            });
        }

        //No Connection.
        if (!this.noSQL && !this.rdb) {
            //Callback.
            if (callback) {
                callback(false);
            }
        }
    }

    /**
     * Connect to NoSQL database.
     * 
     * @param callback optional callback. Will be called when the database is connected.
     */
    private connectNoSQL(callback?: (error?: Error) => void) {
        //Start Connection.
        (this.connection as NoSQL).once('connected', () => {
            //Set connected Flag 
            this._connected = true;

            //Emit Global: connected.
            this.emit('connected');

            //Callback.
            if (callback) {
                callback();
            }
        });
        (this.connection as NoSQL).on('error', (error: Error) => {
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
            this.models.forEach(model => {
                (model as typeof RDBModel).associate();
            });
        } catch (error) {
            this.logger.error(error.stack);
        }

        //Start Connection.
        (this.connection as RDB).authenticate()
            .then(() => {
                //Set connected Flag 
                this._connected = true;

                //Emit Global: connected.
                this.emit('connected');

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
        if (this.rdb || this.noSQL) {
            this.connection.close()
                .then(() => {
                    //Set connected Flag 
                    this._connected = false;

                    //Emit Global: disconnected.
                    this.emit('disconnected');

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
        } else {
            //Callback.
            if (callback) {
                callback();
            }
        }
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
                        this.logger.info(`EXECUTING: DROP COLLECTION IF EXISTS ${name}`);
                        await (this.connection as NoSQL).db.dropCollection(name);
                    }
                    this.logger.info(`EXECUTING: CREATE COLLECTION IF NOT EXISTS ${name}`);
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
            await (this.connection as RDB).sync({ force: force });
        }

        //Setting default.
        force = (force === undefined) ? false : force;

        //Call DB Sync
        try {
            //NoSQL Connection.
            if (this.noSQL) {
                await _noSQLSync();
            }

            //RDB Connection.
            if (this.rdb) {
                await _rdbSync();
            }
            return true;
        } catch (error) {
            throw error;
        }
    }
}

//////////////////////////////
//////Constructor: Options
//////////////////////////////
/**
 * The constructor options for the db manager.
 */
export type Options = {
    /**
     * The name of the database.
     */
    name: string;

    /**
     * The type of the database.
     */
    type: Type;

    /**
     * The remote database address.
     */
    host: string;

    /**
     * The username of the database.
     */
    username: string;

    /**
     * The password of the database.
     */
    password: string;

    /**
     * Set to true if the paper trail operation should be performed, false otherwise.
     * 
     * @default true
     */
    paperTrail?: boolean;
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
 * `ConnectionOptionsError` is an instance of Error.
 * Thrown when a database connection option is invalid.
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

//////////////////////////////
//////ModelError
//////////////////////////////
/**
 * `ModelError` is an instance of Error.
 * Thrown when database `Connection` type and `Model` type do not match.
 */
export class ModelError extends Error {
    constructor(message: string) {
        super(message);

        // Saving class name in the property of our custom error as a shortcut.
        this.name = this.constructor.name;

        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
    }
}