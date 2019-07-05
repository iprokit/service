//Import modules
import {Model} from 'sequelize';

//Local Imports
import {sequelize, name as serviceName} from './app';

export default class SequelizeModel extends Model {
    static modelName: string;
    static tableName: string;

    static init(attributes: any, tableName: any) {
        this.modelName = this.name.toLowerCase().replace('model', '');
        this.tableName = tableName !== undefined ? tableName: serviceName + '_' + this.modelName;

        return super.init(attributes, {modelName: this.modelName, tableName: this.tableName, sequelize});
    }

    static associate() {
    }

    static getName() {
        return this.modelName;
    }

    static getModelByName(name: string) {
        if (sequelize.models[name] !== undefined) {
            return sequelize.models[name];
        } else {
            throw new Error('Model does not exist!');
        }
    }
}
