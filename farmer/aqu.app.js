//Import modules
import {MicroService} from '../mico_sdk/dist/index'

//Import Local
import CustomerController from './customer.controller'
import EndUserController from './endUser.controller'
import EndUserModel from './endUser.model';
import CustomerModel from './customer.model';

//Init & start service
var microService = new MicroService({
    name: "aqu",
    mysql: {
        name: 'CUSTOMER_DB',
        username: 'varaaqu',
        password: 'ipro2019',
        host: 'ec2-13-234-76-76.ap-south-1.compute.amazonaws.com',
        timezone: '+5:30',
        //force:true
    }
});

microService.addModel(EndUserModel);
microService.addModel(CustomerModel);

CustomerModel.findAll()
    .then((data) => {
        console.log("data", data)
    })
    .catch((error) => {
        console.log("error", error)
    });

//Adding controller to microService.
let endUserController = new EndUserController();
microService.createDefaultEndpoints(endUserController);

let customerController = new CustomerController();
microService.createDefaultEndpoints(customerController);

microService.get('/farmerDetails', customerController.findAllFarmers)

//Start the service.
microService.startService();