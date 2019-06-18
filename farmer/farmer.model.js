//Import modules
import {DataTypes} from 'sequelize'

var schema;

class FarmerModel{
    constructor(name, sequelize){
        schema = sequelize.define(name, {
            id: {
                type: DataTypes.INTEGER(6),
                primaryKey: true,
                autoIncrement: true
            },
            first_name: {
                type: DataTypes.STRING(20),
                allowNull: false
            },
            last_name: {
                type: DataTypes.STRING(20),
                allowNull: true
            }
        });
    }

    getSchema(){
        return schema;
    }
}
export default FarmerModel;