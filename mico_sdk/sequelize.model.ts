//Import Local
import {sequelize} from './app'
import {Model} from 'sequelize';

export default class SequelizeModel{
    name: string;
    schema: any;

    //Default Constructor
    constructor(dataTypes: any, _name: string) {
        //Getting class name and setting it as the model name.
        this.name = _name || this.constructor.name.toLowerCase().replace('model', '');

        //Setting up schema object
        if(sequelize !== undefined){
            this.schema = sequelize.define(this.name, dataTypes);
        }else{
            throw new Error("Sequelize connection undefined.");
        }
    }

    getSchema() {
        return this.schema;
    }

    getName() {
        return this.name;
    }
}