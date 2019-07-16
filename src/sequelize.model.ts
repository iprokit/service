//Import modules
import {Model, ModelAttributes, DataTypes} from 'sequelize';

export default class SequelizeModel extends Model {
    public static _modelName(): string{
        return this.name.replace('Model', '');
    }

    public static _tableName(): string{
        //TODO: For every captital letter add _ before. Ex: EndUser = end_user
        return this.name.replace('Model', '').toLowerCase();
    }

    public static fields(dataTypes: typeof DataTypes): ModelAttributes {
        return null;
    }

    public static associate() {}
}
