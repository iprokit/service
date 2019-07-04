//Import modules
import {default as MicroService, sequelize} from '../mico_sdk/dist/app'

//Import Local
import {default as FarmerModel} from './farmer.model'
import FarmerController from './farmer.controller'

//Init & start service
var microService = new MicroService({
    name: "aqu",
    mysql: {
        name: 'IPRO_AQU_ECS_VER4_6',
        username: 'microaqu',
        password: 'iPr0tech$2020',
        timezone: '+5:30'
    }
});

FarmerModel.init();

console.log('farmer app, sequelize', sequelize);

//After all init of model
FarmerModel.associate();

var farmerController = new FarmerController();

microService.createCRUD(FarmerModel, farmerController);

//Start the service.
microService.startService();