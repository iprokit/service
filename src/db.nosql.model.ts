//Import modules
import { Connection as Mongoose, Model, Schema, SchemaDefinition, Document, Types, ModelUpdateOptions } from 'mongoose';

//Local Imports
import model, { FindOptions } from './db.model';

//Export Libs
export { SchemaDefinition as NoSQLModelAttributes, Types as NoSQLDataTypes }

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
     * @alias `$model.create()`
     */
    public static async create(...records: any[]) {
        return await this._model.create(records);
    }

    /**
     * Performs asynchronous, get all records.
     * 
     * @param options the optional find options.
     * 
     * @returns all the records.
     * 
     * @default 
     * options = { order: 'new', pagination: { page: 0, size: 20 } };
     * 
     * @alias `model.find()`
     */
    public static async getAll(options?: FindOptions) {
        let order;

        //Initialize Options.
        options = options ?? {};
        options.pagination = options.pagination ?? {};

        //Order properties.
        if (options.order === 'new' || !options.order) {
            order = { createdAt: -1 };
        } else if (options.order === 'old') {
            order = { createdAt: 1 };
        }

        //Pagination properties.
        const page = model.pagination(options.pagination.page, options.pagination.size);

        return await this.find().sort(order).skip(page.offset).limit(page.limit);
    }

    /**
     * Performs asynchronous, get one record by `model._id`.
     * 
     * @param id the record to retrieve by _id.
     * 
     * @returns the record found, undefined otherwise.
     * 
     * @alias `model.findOne()`
     */
    public static async getOneByID(id: any) {
        return await this.findOne({ _id: id }) ?? {};
    }

    /**
     * Performs asynchronous, update one record by `model._id`.
     * 
     * @param id the record to update by id.
     * @param values the values of the record.
     * 
     * @returns true if the record is successfully updated, false otherwise.
     * 
     * @alias `model.updateOne()`
     */
    public static async updateOneByID(id: any, values: any) {
        const affectedRecords = await this.updateOne({ _id: id }, values);

        if (affectedRecords.n === 0 && affectedRecords.nModified === 0) {
            return false;
        } else {
            return true;
        }
    }

    /**
     * Performs asynchronous, delete one record by `model._id`.
     * 
     * @param id the record to delete by id.
     * 
     * @returns true if the record is successfully deleted, false otherwise.
     * 
     * @alias `model.deleteOne()`
     */
    public static async deleteOneByID(id: any) {
        const affectedRecords = await this.deleteOne({ _id: id });

        if (affectedRecords.n === 0 && affectedRecords.deletedCount === 0) {
            return false;
        } else {
            return true;
        }
    }

    //////////////////////////////
    //////Wrappers
    //////////////////////////////
    /**
     * Performs asynchronous, get one record.
     * 
     * @param conditions the record to retrieve by conditions.
     * @param projection the optional fields to return.
     * @param options the options.
     * 
     * @returns the record found.
     * 
     * @alias `$model.findOne()`
     */
    public static async findOne(conditions?: any, projection?: any, options?: any) {
        return this._model.findOne(conditions, projection, options);
    }

    /**
     * Performs asynchronous, get records.
     * 
     * @param conditions the records to retrieve by conditions.
     * @param projection the optional fields to return.
     * @param options the options.
     * 
     * @returns the records found.
     * 
     * @alias `$model.find()`
     */
    public static find(conditions?: any, projection?: any, options?: any) {
        return this._model.find(conditions, projection, options);
    }

    /**
     * Performs asynchronous, update one record.
     * 
     * @param conditions the record to update by conditions.
     * @param doc the doc of the record.
     * @param options the options.
     * 
     * @returns the record updated.
     * 
     * @alias `$model.updateOne()`
     */
    public static updateOne(conditions: any, doc: any, options?: ModelUpdateOptions) {
        return this._model.updateOne(conditions, doc, options);
    }

    /**
     * Performs asynchronous, update many records.
     * 
     * @param conditions the records to update by conditions.
     * @param doc the doc of the record.
     * @param options the options.
     * 
     * @returns the records updated.
     * 
     * @alias `$model.updateMany()`
     */
    public static updateMany(conditions: any, doc: any, options?: ModelUpdateOptions) {
        return this._model.updateMany(conditions, doc, options);
    }

    /**
     * Performs asynchronous, delete one record.
     * 
     * @param conditions the record to delete by conditions.
     * 
     * @returns the record deleted.
     * 
     * @alias `$model.deleteOne()`
     */
    public static deleteOne(conditions: any) {
        return this._model.deleteOne(conditions);
    }

    /**
     * Performs asynchronous, delete many records.
     * 
     * @param conditions the records to delete by conditions.
     * 
     * @returns the records deleted.
     * 
     * @alias `$model.deleteMany()`
     */
    public static deleteMany(conditions: any) {
        return this._model.deleteMany(conditions);
    }

    /**
     * Performs asynchronous, aggregations on the records.
     * 
     * @param conditions the records to aggregate.
     * 
     * @returns the records aggregated.
     * 
     * @alias `$model.aggregate()`
     */
    public static aggregate(aggregations?: any[]) {
        return this._model.aggregate(aggregations);
    }

    /**
     * Performs asynchronous, counts number of matching records.
     * 
     * @param conditions the records to count by conditions.
     * 
     * @returns the count.
     * 
     * @alias `$model.count()`
     */
    public static count(conditions: any) {
        return this._model.count(conditions);
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
     * Note: Should not be called by the consumer.
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

        //Set Names.
        Object.defineProperty(this, 'name', { value: options.modelName });
        Object.defineProperty(this._model, 'name', { value: options.modelName });
    }
}

//////////////////////////////
//////Init: Options
//////////////////////////////
/**
 * The initialization options for the model.
 */
export type InitOptions = {
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