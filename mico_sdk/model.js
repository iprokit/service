//Init variables
var _name;
var _schema;

class Model{
    //Default Constructor
    constructor(dataTypes, sequelizeConnection, name){
        if(sequelizeConnection == 'undefined' || sequelizeConnection == null || sequelizeConnection == ''){
            throw new Error("Sequelize connection object is required.");
        }
        
        //Getting class name and setting it as the model name.
        _name = name || this.constructor.name.toLowerCase().replace('model', '');

        //Setting up schema object
        _schema = sequelizeConnection.define(_name, dataTypes);
    }

    getSchema(){
        return _schema;
    }

    getName(){
        return _name;
    }
}
export default Model;