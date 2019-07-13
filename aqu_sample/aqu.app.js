//Import modules
import {MicroService} from '../mico_sdk/dist/index'

//Import Controllers
import CustomerController from '../aqu_sample/aqu_endpoints/customer/customer.controller'
import EndUserController from '../aqu_sample/aqu_endpoints/enduser/endUser.controller'

class AQUApp extends MicroService{
    constructor(){
        super();
    }

    init(){
        const endUserController = new EndUserController();
        this.createDefaultEndpoints(endUserController);
        this.get('/farmer/customer/details', endUserController.customerDetailsByID);
        
        const customerController = new CustomerController();
        this.createDefaultEndpoints(customerController);
        this.get('/customer/farmer/details', customerController.findAllFarmers);
    }
}
const aquApp = new AQUApp();