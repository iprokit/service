//Import modules
import MicroService from '../mico_sdk/dist/app'

//Import Local
import FarmerModel from './farmer.model'
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

var farmerModel = new FarmerModel();
var farmerController = new FarmerController(farmerModel);

microService.createCRUD(farmerModel, farmerController);

//Start the service.
microService.startService();