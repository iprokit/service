//Import modules
import {MicroService} from '../mico_sdk/dist/index'

//Import Local
import CustomerController from './customer.controller'
import EndUserController from './endUser.controller'

//Init & start service
var microService = new MicroService({
    name: "aqu",
    mysql: {
        name: 'CUSTOMER_DB',
        username: 'varaaqu',
        password: 'ipro2019',
        host: 'ec2-13-234-76-76.ap-south-1.compute.amazonaws.com',
        // name: 'IPRO_AQU_ECS_VER4_6',
        // username: 'microaqu',
        // password: 'iPr0tech$2020',
        timezone: '+5:30'
    }
});

//Adding controller to microService.
let endUserController = new EndUserController();
microService.createDefaultServices(endUserController);

let customerController = new CustomerController();
microService.createDefaultServices(customerController);

microService.get('/farmerDetails', customerController.findAllFarmers)

//Start the service.
microService.startService();
