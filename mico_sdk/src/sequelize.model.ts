//Import modules
import {Model, ModelAttributes} from 'sequelize'

//Local Imports
import { serviceName } from './app';

export default class SequelizeModel extends Model {
    static _modelName(): string{
        return this.name.replace('Model', '');
    }

    static _tableName(): string{
        //TODO: For every captital letter add _ before. Ex: EndUser = end_user
        return (serviceName + '_' + this.name.replace('Model', '')).toLowerCase();
    }

    static fields(): ModelAttributes {
        return null;
    }

    static associate() {}
}
