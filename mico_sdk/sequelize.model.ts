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
    static setTableName(name: string){
        this.tableName = name;
    }

    static getTableName(): string{
        return this.tableName;
    }
}
