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
        FarmerModel._belongsTo('farmer', {foreignKey: 'customer_id'});
        //this.myAssociation = this.belongsTo(models.OtherModel);
        // or
        //this.myAssociation = models.MyModel.belongsTo(models.OtherModel);

        //this.hasMany(this.sequelizeConnection.models.aqu_enduser, { foreignKey: 'customer_id', targetKey: 'customer_id' })
        super.associate();
    }
}