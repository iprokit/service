//Import modules
import {MicroService} from '../mico_sdk/dist/index'

//Import Local
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

//Adding controller to microService.
microService.createDefaultServices(new FarmerController());

//Start the service.
microService.startService();
