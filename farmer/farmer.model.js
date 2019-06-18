//Import modules
import {DataTypes} from 'sequelize'
import Model from '../mico_sdk/model'

class FarmerModel extends Model{
    //Default Constructor
    constructor(sequelizeConnection){
        super({
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
        }, sequelizeConnection);
    }
}
export default FarmerModel;