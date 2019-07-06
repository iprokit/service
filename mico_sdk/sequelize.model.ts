import {Sequelize, Model, ModelAttributes} from 'sequelize'

export default class SequelizeModel extends Model {
    static tableName: string;
    
    static fields():ModelAttributes {
        return null;
    }

    static associate(models: {[key: string]: typeof Model}) {}

    /////////////////////////
    ///////Setters/Getters
    /////////////////////////
    //TODO: Remove getters and setters from this.
    static setTableName(name: string){
        this.tableName = name;
    }

    static getTableName(): string{
        return this.tableName;
    }
}
