import {Model, ModelAttributes} from 'sequelize'

export default class SequelizeModel extends Model {
    static tableName: string;
    
    static fields():ModelAttributes {
        return null;
    }

    static associate(models: {[key: string]: typeof Model}) {}
}
