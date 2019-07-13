//Import modules
import {MicroService} from '../mico_sdk/dist/index'

//Import Controllers
import CustomerController from '../aqu_sample/aqu_endpoints/customer/customer.controller'
import EndUserController from '../aqu_sample/aqu_endpoints/enduser/endUser.controller'

class AQUApp extends MicroService{
    constructor(){
        const options = {
            mysql: {
                name: 'CUSTOMER_DB',
                username: 'varaaqu',
                password: 'ipro2019',
                host: 'ec2-13-234-76-76.ap-south-1.compute.amazonaws.com',
                timezone: '+5:30'
            }
        };
        super(options);
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