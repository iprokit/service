//Import modules
import {DataTypes} from 'sequelize'
import Model from '../mico_sdk/dist/sequelize.model'

export default class FarmerModel extends Model {
    static init(){
        super.init({
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

    static associate() {
        this.belongsTo(this.getModelByName('farmer'), {foreignKey: 'customer_id'});
        //this.hasMany(this.getModel().farmer, { foreignKey: 'customer_id', targetKey: 'customer_id' });
        super.associate();
    }
}