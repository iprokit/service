import { Model, DataTypes } from 'sequelize';
import Customer from './customer';

export default class Enduser extends Model {
    static fields(){
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
            phone1: {
                type: DataTypes.STRING(15),
                allowNull: false,
                unique: true
            }
        };
    }
    static associate() {
        this.belongsTo(Customer, { foreignKey: 'customer_id'})
    }
}