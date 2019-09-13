//Import modules
import { Model, SchemaDefinition } from 'mongoose';

export default class NoSQLModel extends Model{
    public static _modelName(): string{
        return this.name.replace('Model', '');
    }

    public static _tableName(): string {
        //return this.name.replace('Model', '').toLowerCase();
        return this.name.replace('Model', '');
    }

    public static fields(): SchemaDefinition {
        return null;
    }

    /////////////////////////
    ///////DAO's
    /////////////////////////
    // public static async getAll(){
    //     return await this.find({});
    // }

    // public static async getOneByID(id: any){
    //     return await this.findById(id);
    // }
}

// model.find - getAll
// model.findById - getOneByID
// model.create - create
// model.updateOne - updateOneByID
// model.deleteOne - deleteOneByID