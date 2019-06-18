//Import modules
import {Sequelize, DataTypes} from 'sequelize'
import MicroService from '../mico_sdk/index'

//Import Models
import FarmerModel from './farmer.model'

//Import Controllers
import FarmerController from './farmer.controller'

//Init & start service
var microService = new MicroService({ name: "farmer",
    mysql: {
        name: 'IPRO_AQU_ECS_VER4_6',
        username: 'microaqu',
        password: 'iPr0tech$2020',
        timezone: '+5:30'
    }
    });

var sequelize = microService.getSequelize();

// //Need to move the below schema into a model
// var farmerModel = sequelize.define('farmer',{
//     id: {
//         type: DataTypes.INTEGER(6),
//         primaryKey: true,
//         autoIncrement: true
//     },
//     first_name: {
//         type: DataTypes.STRING(20),
//         allowNull: false
//     },
//     last_name: {
//         type: DataTypes.STRING(20),
//         allowNull: true
//     }
// });

var farmerModel = new FarmerModel();
farmerModel.init(sequelize);

var farmerController = new FarmerController(farmerModel);

microService.createCRUD(farmerController);

//Start the service.
microService.startService();