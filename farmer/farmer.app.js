//Import modules
import MicroSDK from '@iprotechs/ipromicro'
//Import Models
let MicroService = MicroSDK.microService;
import FarmerModel from './farmer.model'
//Import Controllers
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

var sequelizeConnection = microService.getSequelize();
var farmerModel = new FarmerModel(sequelizeConnection);

var farmerController = new FarmerController(farmerModel);

microService.createCRUD(farmerModel, farmerController);

//Start the service.
microService.startService();
