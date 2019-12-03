//Import modules
import { Connection as Mongoose, Model, Schema, SchemaDefinition, Document } from 'mongoose';

//Local Imports
import { EntityOptions } from './db.manager';

//Export model Types.
export const NoSQLTypes: typeof Schema.Types = Schema.Types;

//Types: InitOptions
export type InitOptions = {
    collectionName: string,
    modelName: string,
    mongoose: Mongoose,
    timestamps: boolean,
}

export default abstract class NoSQLModel {
    public static entityOptions: EntityOptions;

    private static mongoose: Mongoose;
    private static model: Model<Document>;

    /////////////////////////
    ///////init Functions
    /////////////////////////
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
        this.model = this.mongoose.model(options.modelName, schema, options.collectionName);
    }

    /////////////////////////
    ///////Others
    /////////////////////////
    private static transformConditions(conditions: any){
        //If id exists in conditions replace with _id
        if(conditions.id){
            conditions._id = conditions.id;
            delete conditions.id;
        }
    }

    private static transformJson(object: any){
        //Start: Find all keys in json object
        for(let key in object){
            if(object[key] instanceof Date){
                let date: Date = object[key];
                object[key] = date.toUTCString();
            }
        }
    }

    /////////////////////////
    ///////DAO's
    /////////////////////////
    public static async create(...docs: any[]){
        return await this.model.create(docs);
    }
    
    //TODO: Need to remove this function in coming versions.
    public static async getAllOrderByCreatedAt(orderType: string){
        if(orderType === 'new'){
            return await this.model.find().sort({createdAt: -1});
        } else if(orderType === 'old'){
            return await this.model.find().sort({createdAt: 1});
        }
    }

    public static async getAll(){
        return await this.model.find();
    }

    public static async getOne(conditions: any){
        this.transformConditions(conditions);
        return await this.model.findOne(conditions)
            .then(async data => {
                if(data){
                    return data
                }else{
                    throw new Error('No records found!');
                }
            })
            .catch(error => {
                throw error;
            });
    }

    public static async updateOne(conditions: any, doc: any){
        this.transformConditions(conditions);
        return await this.model.updateOne(conditions, doc)
            .then(async affectedRows => {
                if (affectedRows.n === 0 && affectedRows.nModified === 0) {
                    throw new Error('No records found!');
                }else{
                    return true;
                }
            })
            .catch(error => {
                throw error;
            });
    }

    public static async deleteOne(conditions: any){
        this.transformConditions(conditions);
        return await this.model.deleteOne(conditions)
            .then(async affectedRows => {
                if (affectedRows.n === 0 && affectedRows.deletedCount === 0) {
                    throw new Error('No records found!');
                }else{
                    return true;
                }
            })
            .catch(error => {
                throw error;
            });
    }

    public static async getOneByID(id: any){
        return await this.getOne({id: id});
    }

    public static async updateOneByID(id: any, update: any){
        return await this.updateOne({id: id}, update);
    }

    public static async deleteOneByID(id: any){
        return await this.deleteOne({id: id});
    }
}