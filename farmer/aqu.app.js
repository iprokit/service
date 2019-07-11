//Import modules
import {MicroService} from '../mico_sdk/dist/index'

//Import Controllers
import CustomerController from './customer.controller'
import EndUserController from './endUser.controller'

//Init & start service
var microService = new MicroService({
    name: "AQU",
    mysql: {
        name: 'CUSTOMER_DB',
        username: 'varaaqu',
        password: 'ipro2019',
        host: 'ec2-13-234-76-76.ap-south-1.compute.amazonaws.com',
        timezone: '+5:30',
        //force:true
    }
});

//Adding controller to microService.
let endUserController = new EndUserController();
microService.createDefaultEndpoints(endUserController);

let customerController = new CustomerController();
microService.createDefaultEndpoints(customerController);
microService.get('/farmerDetails', customerController.findAllFarmers)

//Start the service.
microService.startService();