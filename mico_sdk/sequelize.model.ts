//Import Local
import {sequelize} from './app'

var name: string;
var schema: any;

export default class SequelizeModel{
    //Default Constructor
    constructor(dataTypes: any, _name: string) {
        //Getting class name and setting it as the model name.
        name = _name || this.constructor.name.toLowerCase().replace('model', '');

        //Setting up schema object
        if(sequelize !== undefined){
            schema = sequelize.define(name, dataTypes);
        }else{
            throw new Error("Sequelize connection undefined.");
        }
    }

    getSchema() {
        return schema;
    }

    getName() {
        return name;
    }
}