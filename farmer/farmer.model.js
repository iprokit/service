//Import modules
import {DataTypes} from 'sequelize'

import Model from '../mico_sdk/dist/sequelize.model'

export default class FarmerModel extends Model {
    //Default Constructor
    constructor() {
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
        });

    }

    association() {
        this.schema.hasMany(this.sequelizeConnection.models.aqu_enduser, { foreignKey: 'customer_id', targetKey: 'customer_id' })
    }
}