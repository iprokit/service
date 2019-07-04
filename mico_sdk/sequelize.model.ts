//Import Local
import {sequelize, serviceName} from './app'
import {Model} from 'sequelize';

export default class SequelizeModel extends Model{
    static modelName: string;
    static tableName: string;
    
    static init(attributes: any, name: any){
        this.modelName = this.name.toLowerCase().replace('model', '');
        
        this.tableName = name || serviceName + '_' + this.modelName;

        return super.init(attributes, {modelName: this.modelName, tableName: this.tableName, sequelize});
    }

    static getName() {
        return this.modelName;
    }

    //Might not need this.
    // static _belongsTo(name: any, key: any) {
    //     return this.belongsTo(name, key);
    // }
}