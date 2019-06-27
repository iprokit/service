//Init variables

class Model {
    _name: string;
    _schema: any;

    //Default Constructor
    constructor(dataTypes: any, sequelizeConnection: any, name: string) {
        if (sequelizeConnection == 'undefined' || sequelizeConnection == null || sequelizeConnection == '') {
            throw new Error('Sequelize connection object is required.');
        }

        //Getting class name and setting it as the model name.
        this._name = name || this.constructor.name.toLowerCase().replace('model.ts', '');

        //Setting up schema object
        this._schema = sequelizeConnection.define(this._name, dataTypes);
    }

    getSchema() {
        return this._schema;
    }

    getName() {
        return this._name;
    }
}

export default Model;
