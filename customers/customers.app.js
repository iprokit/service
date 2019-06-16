//Import modules
import MicroService from '../mico_sdk/index'

//Local Imports
import CustomersController from './customers.controller'
import CustomersModel from './customers.model'

//Init & start service
const microService = new MicroService({name: 'customers'});

const customersController = new CustomersController();
microService.get('/:id', customersController.selectOneByID);
microService.get('/', customersController.selectAll);
microService.post('/', customersController.add);
microService.put('/', customersController.update);
microService.delete('/:id', customersController.deleteOneByID);


// const customersModel = new CustomersModel()
// microService.createCRUD(customersModel);

microService.startService();