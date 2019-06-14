//Import Modules or Paths 
import Sequelize from 'sequelize' 
import dotenv from 'dotenv'
dotenv.config() 
//sequelize connection setup
const sequelize = new Sequelize(process.env.DB_NAME || 'feed_db', process.env.DB_USERNAME, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: process.env.DB_DIALECT || 'mysql',
  operatorsAliases: false,
  pool: {
      max: process.env.DB_MAX_POOL || 3,
      min: process.env.DB_MIN_POOL || 2,
      acquire: process.env.DB_ACQUIRE_POOL || 30000,
      idle: process.env.DB_IDLE_POOL || 10000
  }
});
// Sequelize Sync
sequelize.sync({force:false})
  .then(() => {
    console.log(`Database & tables created!`)
  })
  .catch(error =>{
    console.log("Error is................",error)
  })
//Export sequelize connection                        
export default sequelize