//Import modules
import {SequelizeModel} from '../../../mico_sdk/dist/index'

//Import Local
import CustomerModel from '../customer/customer.model';

export default class EndUserModel extends SequelizeModel {
    static _tableName(){
        return 'enduser';
    }

    static fields(DataTypes) {
        return {
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
            },
            phone1: {
                type: DataTypes.STRING(15),
                allowNull: false,
                unique: true
            },
            customer_id: {
                type: DataTypes.INTEGER(6),
                references: {
                    model: 'aqu_customer',
                    key: 'id'
                },
                allowNull: false
            }
        };
    }

    static associate() {
        this.belongsTo(CustomerModel, { foreignKey: 'customer_id'})
    }
}
