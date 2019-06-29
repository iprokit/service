//Import modules
import {DataTypes} from 'sequelize'
import MicroSDK from '@iprotechs/ipromicro'
let Model = MicroSDK.model;

class FarmerModel extends Model {
    //Default Constructor
    constructor(sequelizeConnection) {
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

    association() {
        super.association();
        // association logic

    }
}

export default FarmerModel;
