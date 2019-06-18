//Import modules
import {Model, DataTypes} from 'sequelize'

var schema;

class FarmerModel{
    init(sequelize){
        schema = sequelize.define('farmer',{
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