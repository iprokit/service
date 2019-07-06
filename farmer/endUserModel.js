import {DataTypes, Model} from 'sequelize'

export default class EndUser extends Model {
    static init(sequelize) {
        return super.init({
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
            email: {
                type: DataTypes.STRING(30),
                allowNull: true
            },
            username: {
                type: DataTypes.STRING(30),
                allowNull: true
            },
            password: {
                type: DataTypes.STRING(50),
                allowNull: false
            },
            customer_id: {
                type: DataTypes.INTEGER(6),
                references: {
                    model: 'aqu_customer',
                    key: 'id'
                },
                allowNull: false
            },
            isActive: {
                type: DataTypes.BOOLEAN,
                allowNull: true,
                default: 1
            }
        }, {tableName: 'aqu_enduser', sequelize});
    }

    static associate(models) {
        try {
            this.belongsTo(models.Customer, { foreignKey: 'customer_id'})
        } catch (error) {
            console.log(error)
        }
    }
}
