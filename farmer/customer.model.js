//Import modules
import {SequelizeModel} from '../mico_sdk/dist/index'
import {DataTypes} from 'sequelize'

//Import Local
import EndUserModel from './endUser.model';

export default class CustomerModel extends SequelizeModel {
    static fields() {
        this.tableName = 'aqu_customer';
        return {
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
        };
    }

    static associate() {
        this.hasMany(EndUserModel, { foreignKey: 'customer_id', targetKey: 'customer_id' })
    }
}
