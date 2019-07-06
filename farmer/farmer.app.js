//Import modules
import {MicroService} from '../mico_sdk/dist/index'

//Import Local
import CustomerController from './customer.controller'
import EndUserController from './endUser.controller'
import EndUserModel from './endUserModel';
import CustomerModel from './customerModel';

//Init & start service
var microService = new MicroService({
    name: "aqu",
    mysql: {
        name: 'CUSTOMER_DB',
        username: 'varaaqu',
        password: 'ipro2019',
        host: 'ec2-13-234-76-76.ap-south-1.compute.amazonaws.com',
        timezone: '+5:30'
    }
});

microService.addModel(EndUserModel);
microService.addModel(CustomerModel);

//Adding controller to microService.
// let endUserController = new EndUserController();
// microService.createDefaultServices(endUserController);

// let customerController = new CustomerController();
// microService.createDefaultServices(customerController);

// microService.get('/farmerDetails', customerController.findAllFarmers)

//Start the service.
microService.startService();
