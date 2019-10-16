//Import modules
import Mongoose, { Model, Schema, SchemaDefinition, Document } from 'mongoose';

//Types: InitOptions
export type InitOptions = {
    collectionName: string,
}

export default class NoSQLModel {
    private static model: Model<Document>;

    public static _modelName(): string{
        return this.name.replace('Model', '');
    }

    public static _collectionName(): string {
        return this.name.replace('Model', '').toLowerCase();
    }

    public static fields(dataTypes: typeof Schema.Types): SchemaDefinition {
        return null;
    }

    public static init(attributes: SchemaDefinition, options: InitOptions) {
        const schema = new Schema(attributes);
        this.model = Mongoose.model(options.collectionName, schema);
    }

    /////////////////////////
    ///////DAO's
    /////////////////////////
    public static async getOneByID(id: any){
        return await this.model.findById(id);
    }

    public static async getAll(){
        return await this.model.find();
    }

    public static async create(...docs: any[]){
        return await this.model.create(docs);
    }

    public static async update(conditions: any, doc: any){
        return await this.model.update(conditions, doc);
    }

    public static async updateOne(conditions: any, doc: any){
        return await this.model.updateOne(conditions, doc)
    }

    public static async updateOneByID(id: any){
        //TODO: work on this.
        //return await this.model.updateOne(conditions, doc)
    }

    public static async deleteOne(conditions: any){
        return await this.model.deleteOne(conditions);
    }

    public static async deleteMany(conditions: any){
        return await this.model.deleteMany(conditions);
    }

    public static async deleteOneByID(id: any){
        //TODO: work on this.
        //return await this.model.deleteOne(conditions);
    }
}