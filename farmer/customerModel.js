import {DataTypes} from 'sequelize'

import {Model} from '../mico_sdk/dist/index'

export default class CustomerModel extends Model {
    static init() {
        super.init({
            id: {
                type: DataTypes.INTEGER(6),
                primaryKey: true,
                autoIncrement: true
            },
            first_name: {
                type: DataTypes.STRING(30),
                allowNull: false
            },
            last_name: {
                type: DataTypes.STRING(30),
                allowNull: true
            },
            contract_start_date: {
                type: DataTypes.DATE,
                allowNull: true
            },
            contract_end_date: {
                type: DataTypes.DATE,
                allowNull: true
            },
            phone1: {
                type: DataTypes.STRING(15),
                allowNull: false,
                unique: true
            },
            email: {
                type: DataTypes.STRING(40),
                allowNull: true,
                unique: true
            }
        });
    }
    static associate() {
        try {
            this.hasMany(this.getModelByName('enduser'), { foreignKey: 'customer_id', targetKey: 'customer_id' })
        } catch (error) {
            console.log(error)
        }
        super.associate()
    }
}
