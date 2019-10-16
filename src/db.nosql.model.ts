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
        NoSQLModel.model = Mongoose.model(options.collectionName, schema);
    }

    /////////////////////////
    ///////DAO's
    /////////////////////////
    public static async getAll(){
        return await NoSQLModel.model.find({});
    }

    public static async getOneByID(id: any){
        return await NoSQLModel.model.findById(id);
    }
}

// model.find - getAll
// model.findById - getOneByID
// model.create - create
// model.updateOne - updateOneByID
// model.deleteOne - deleteOneByID