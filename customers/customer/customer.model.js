//Import Modules or Paths
import Sequelize from 'sequelize'
import sequelize from "../config/rds.sequelize"
//Create a Schema
const CustomerSchema = sequelize.define('customer', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false
    }
});

export default CustomerSchema