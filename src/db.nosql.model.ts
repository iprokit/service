//Import modules
import { Connection as Mongoose, Model, Schema, SchemaDefinition, Document } from 'mongoose';

/**
 * A generic `NoSQLModel` is a wrapper around `Mongoose` model.
 */
export default class NoSQLModel {
    /**
     * The underlying `Mongoose` connection.
     */
    public static mongoose: Mongoose;

    /**
     * The underlying `Mongoose` model.
     */
    public static _model: Model<Document>;

    //////////////////////////////
    //////DAO's
    //////////////////////////////
    /**
     * Performs asynchronous, create a new record/'s.
     * 
     * @param records the record/'s.
     * 
     * @returns the created record/'s.
     * 
     * @alias `model.create()`
     */
    public static async create(...records: any[]) {
        return await this._model.create(records);
    }

    /**
     * Performs asynchronous, get all records.
     * 
     * @returns all the records.
     * 
     * @alias `model.find()`
     */
    public static async getAll() {
        return await this._model.find();
    }

    /**
     * Performs asynchronous, get all records by `model.createdAt`.
     * 
     * @param orderType set to `new` if latest records should be on the top,
     * `old` if latest records should be at the bottom.
     * 
     * @returns all the records.
     * 
     * @alias `model.find().sort()`
     */
    public static async getAllOrderByCreatedAt(orderType: 'new' | 'old') {
        if (orderType === 'new') {
            return await this._model.find().sort({ createdAt: -1 });
        } else if (orderType === 'old') {
            return await this._model.find().sort({ createdAt: 1 });
        }
    }

    /**
     * Performs asynchronous, get one record by `model._id`.
     * 
     * @param id the record to retrieve by _id.
     * 
     * @returns the record found.
     * 
     * @throws `Error` if no records found.
     * 
     * @alias `model.findOne()`
     */
    public static async getOneByID(id: any) {
        return await this._model.findOne({ _id: id })
            .then(async data => {
                if (data) {
                    return data
                } else {
                    throw new Error('No records found!');
                }
            })
            .catch(error => {
                throw error;
            });
    }

    /**
     * Performs asynchronous, update one record by `model._id`.
     * 
     * @param id the record to update by id.
     * @param values the values of the record.
     * 
     * @returns `true` if the record is successfully updated.
     * 
     * @throws error if the update failed. Due to, no record found.
     * 
     * @alias `model.updateOne()`
     */
    public static async updateOneByID(id: any, values: any) {
        return await this._model.updateOne({ _id: id }, values)
            .then(async affectedRows => {
                if (affectedRows.n === 0 && affectedRows.nModified === 0) {
                    throw new Error('No records found!');
                } else {
                    return true;
                }
            })
            .catch(error => {
                throw error;
            });
    }

    /**
     * Performs asynchronous, delete one record by `model._id`.
     * 
     * @param id the record to delete by id.
     * 
     * @returns `true` if the record is successfully deleted.
     * 
     * @throws error if the delete failed. Due to, no record found.
     * 
     * @alias `model.deleteOne()`
     */
    public static async deleteOneByID(id: any) {
        return await this._model.deleteOne({ _id: id })
            .then(async affectedRows => {
                if (affectedRows.n === 0 && affectedRows.deletedCount === 0) {
                    throw new Error('No records found!');
                } else {
                    return true;
                }
            })
            .catch(error => {
                throw error;
            });
    }

    //////////////////////////////
    //////Properties
    //////////////////////////////
    /**
     * Wrapper to declare hooks.
     */
    public static hooks() { }

    //////////////////////////////
    //////Init
    //////////////////////////////
    /**
     * Initializes the model by creating a new `Schema` and assigning the given `InitOptions`.
     * 
     * Note: Should not be called by the user.
     * 
     * @param attributes the attributes/fields of the model.
     * @param options the `InitOptions` 
     */
    public static init(attributes: SchemaDefinition, options: InitOptions) {
        //Creates a schema with timestamp audit fields, no version key(__v), id instead of _id.
        const schema = new Schema(attributes, {
            timestamps: options.timestamps,
            toJSON: {
                virtuals: true,
                versionKey: false,
                transform: (doc: any, ret: any, options: any) => {
                    delete ret._id;
                }
            }
        });

        this.mongoose = options.mongoose;
        this._model = this.mongoose.model(options.modelName, schema, options.collectionName);
    }

}

//////////////////////////////
//////InitOptions
//////////////////////////////
/**
 * Interface for the initialization options of a model.
 */
export interface InitOptions {
    /**
     * The name of the collection.
     */
    collectionName: string;

    /**
     * The name of the `Model`.
     */
    modelName: string;

    /**
     * The underlying `Mongoose` connection.
     */
    mongoose: Mongoose;

    /**
     * Set to true if the timestamp fields should be added, false otherwise.
     */
    timestamps: boolean;
}