//Import modules
import MicroService from '../mico_sdk/index'
import dotenv from 'dotenv'
dotenv.config()
//Local Imports
import FarmerController from './farmer.controller'
let config = {
    name: "farmer",
    db: {
        name: process.env.DB_NAME,
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST,
        dialect: process.env.DB_DIALECT,
        isAuth: false,
        isSync: true,
    }
}
//Init & start service
const microService = new MicroService(config);

const farmerController = new FarmerController();
microService.createCRUD(farmerController);

microService.startService();