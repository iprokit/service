//Import modules
import {default as MicroService} from '../mico_sdk/dist/app'

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

//Load Models by calling init
FarmerModel.init();

//After all init's of models
FarmerModel.associate();

//Init Controllers
var farmerController = new FarmerController();

//Forward controller to CRUD
microService.createCRUD(farmerController);

//Start the service.
microService.startService();