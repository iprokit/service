//Import Modules or Paths
import Sequelize from 'sequelize'
import CustomSequelize from '../ConfigFiles/sequelize'
//CUSTOM SEQUELIZE
const sequelize = new CustomSequelize(Sequelize,true,false,
    process.env.DB_NAME,
    process.env.DB_USERNAME,
    process.env.DB_PASSWORD,
    process.env.DB_HOST,
    process.env.DB_DIALECT,
    process.env.DB_MAX_POOL,
    process.env.DB_MIN_POOL,
    process.env.DB_ACQUIRE_POOL,
    process.env.DB_IDLE,
)
sequelize.init()
//Create a Schema
const BookSchema = sequelize.sequelize.define('book', {
    id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: Sequelize.STRING,
        allowNull: false
    },
    customer_id: {
        type: Sequelize.INTEGER,
        allowNull: false
    }
});

export default BookSchema