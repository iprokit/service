//Import modules
import { Sequelize as RDB, Dialect } from 'sequelize';
import mongoose, { Connection as NoSQL } from 'mongoose';
import { Logger } from 'winston';

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
 */
export default class DBManager {
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
     * Set to true if RDB is connected, false otherwise.
     */
    private _rdbConnected: boolean;

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
     * @param options the constructor options.
     */
    constructor(options: Options) {
        //Initialize variables.
        this.name = options.connection.name;
        this.type = options.connection.type;
        this.host = options.connection.host;
        this.username = options.connection.username;
        this.password = options.connection.password;
        this.paperTrail = options.connection.paperTrail ?? true;
        this.logger = options.logger;

        //Initialize NoSQL connection object.
        if (this.noSQL) {
            //Mongoose connection.
            this.connection = mongoose.connection;
            mongoose.set('debug', (collectionName: string, method: string, query: string, doc: string) => {
                this.logger.info(`Executing: ${method} ${collectionName}: ${JSON.stringify(query)}`);
            });
        }

        //Initialize RDB connection object.
        if (this.rdb) {
            //Sequelize constructor.
            this.connection = new RDB(this.name, this.username, this.password, {
                host: this.host,
                dialect: (this.type as Dialect),
                pool: {
                    min: 1,
                },
                hooks: {
                    afterConnect: () => {
                        this._rdbConnected = true;
                    },
                    afterDisconnect: () => {
                        this._rdbConnected = false;
                    }
                },
                logging: (query: string) => {
                    this.logger.info(query);
                },
            });
        }
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
     * True if the database is `RDB` type.
     */
    public get rdb() {
        return this.type === 'mysql' || this.type === 'postgres' || this.type === 'sqlite' || this.type === 'mariadb' || this.type === 'mssql';
    }

    /**
     * True if the database is connected, false otherwise.
     */
    public get connected() {
        if (this.noSQL) {
            return ((this.connection as NoSQL).readyState === 1) ? true : false;
        }
        if (this.rdb) {
            return this._rdbConnected ?? false;
        }
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
     * 
     * @throws `InvalidConnectionOptions` when a database connection option is invalid.
     */
    public connect(callback?: (error?: Error) => void) {
        //NoSQL Connection
        if (this.noSQL) {
            this.connectNoSQL((error) => {
                //Callback.
                if (callback) {
                    callback(error);
                }
            });
        }

        //RDB Connection.
        if (this.rdb) {
            this.connectRDB((error) => {
                //Callback.
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
     * 
     * @throws `InvalidConnectionOptions` when a database connection option is invalid.
     */
    private async connectNoSQL(callback?: (error?: Error) => void) {
        try {
            //Start Connection.
            await mongoose.connect(`mongodb://${this.host}`, {
                dbName: this.name,
                user: this.username,
                pass: this.password,
                useNewUrlParser: true,
                useUnifiedTopology: true
            });

            //Callback.
            if (callback) {
                callback();
            }
        } catch (error) {
            //Callback with error.
            if (callback) {
                callback(new InvalidConnectionOptions(error.message));
            }
        }
    }

    /**
     * Connect to RDB database.
     * 
     * `model.associate()` is called on all the models before the connection.
     * 
     * @param callback optional callback. Will be called when the database is connected.
     * 
     * @throws `InvalidConnectionOptions` when a database connection option is invalid.
     */
    private async connectRDB(callback?: (error?: Error) => void) {
        try {
            //Associate models.
            this.models.forEach(model => {
                (model as typeof RDBModel).associate();
            });

            //Start Connection.
            await (this.connection as RDB).authenticate();

            //Callback.
            if (callback) {
                callback();
            }
        } catch (error) {
            //Callback with error.
            if (callback) {
                callback(new InvalidConnectionOptions(error.message, error.original.code, error.original.errno));
            }
        }
    }

    /**
     * Disconnect from the database.
     * 
     * @param callback optional callback. Will be called when the database is disconnected.
     */
    public async disconnect(callback?: (error?: Error) => void) {
        try {
            //Close the connection.
            await this.connection.close();

            //Callback.
            if (callback) {
                callback();
            }
        } catch (error) {
            //Callback with error.
            if (callback) {
                callback(error);
            }
        }
    }

    //////////////////////////////
    //////Sync
    //////////////////////////////
    /**
     * Performs asynchronous, sync operation on the database.
     * 
     * @param force set to true if the sync operation should be forced, false otherwise and by default.
     */
    public async sync(force?: boolean) {
        /**
         * Performs asynchronous, sync operation on noSQL database.
         * 
         * @function
         */
        const _noSQLSync = async () => {
            const models = this.models;
            for (let index = 0; index < models.length; index++) {
                const model = models[index];
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
            }
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
        force = force ?? false;

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
     * The database connection options.
     */
    connection: ConnectionOptions;

    /**
     * The logger instance.
     */
    logger: Logger;
}

/**
 * The connection options for the database.
 */
export type ConnectionOptions = {
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
//////InvalidConnectionOptions
//////////////////////////////
/**
 * `InvalidConnectionOptions` is an instance of Error.
 * Thrown when a database connection option is invalid.
 */
export class InvalidConnectionOptions extends Error {
    /**
     * The error code.
     */
    public code: string;

    /**
     * The error number.
     */
    public errno: number | string;

    /**
     * Creates an instance of `InvalidConnectionOptions`.
     * 
     * @param message the error message.
     * @param code the error code.
     * @param errno the error number.
     */
    constructor(message: string, code?: string, errno?: number | string) {
        super(message);

        //Initialize Options.
        this.code = code;
        this.errno = errno;

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
    /**
     * Creates an instance of `ModelError`.
     * 
     * @param message the error message.
     */
    constructor(message: string) {
        super(message);

        // Saving class name in the property of our custom error as a shortcut.
        this.name = this.constructor.name;

        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
    }
}