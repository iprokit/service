//Import modules
import Mongoose, { Model, Schema, SchemaDefinition, Document } from 'mongoose';

//Types: InitOptions
export type InitOptions = {
    collectionName: string,
    modelName: string,
}

export default abstract class NoSQLModel {
    private static modelName: string;
    private static collectionName: string;
    private static attributes: SchemaDefinition;
    private static schema: Schema;
    private static model: Model<Document>;

    /////////////////////////
    ///////Gets & Sets
    /////////////////////////
    public static getModelName(){
        return this.modelName;
    }

    public static getCollectionName(){
        return this.collectionName;
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public static init(attributes: SchemaDefinition, options: InitOptions) {
        this.modelName = options.modelName;
        this.collectionName = options.collectionName;

        this.attributes = attributes;
        this.schema = new Schema(this.attributes);
        NoSQLModel.model = Mongoose.model(this.collectionName, this.schema);
    }

    /////////////////////////
    ///////Properties
    /////////////////////////
    public static _modelName(): string{
        return this.name.replace('Model', '');
    }

    public static _collectionName(): string {
        return this.name.replace('Model', '').toLowerCase();
    }

    public static fields(dataTypes: typeof Schema.Types): SchemaDefinition {
        return null;
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
        return await this.model.updateOne(conditions, doc);
    }

    public static async updateOneByID(id: any, update: any){
        return await this.model.findByIdAndUpdate(id, update);
    }

    public static async deleteOne(conditions: any){
        return await this.model.deleteOne(conditions);
    }

    public static async deleteMany(conditions: any){
        return await this.model.deleteMany(conditions);
    }

    public static async deleteOneByID(id: any){
        return await this.model.findByIdAndRemove(id);
    }
}