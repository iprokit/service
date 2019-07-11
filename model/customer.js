import { Model, DataTypes } from "sequelize";
import Enduser from "./enduser";

export default class Customer extends Model {
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
        this.hasMany(Enduser, { foreignKey: 'customer_id', targetKey: 'customer_id' })
    }
}