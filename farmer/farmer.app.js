//Import modules
import MicroService from '../mico_sdk/index'
import dotenv from 'dotenv'
dotenv.config()
//Local Imports
import FarmerController from './farmer.controller'

//Init & start service
const microService = new MicroService({ name: "farmer" });

const farmerController = new FarmerController();
microService.createCRUD(farmerController);

microService.startService();