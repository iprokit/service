import MicroService from '../mico_sdk/index'
import CustomerController from './customers.controller'

const microService = new MicroService({name: 'customer'});
const customerController = new CustomerController();

microService.get('/:id', customerController.selectOneByID)
microService.get('/', customerController.selectAll)
microService.post('/', customerController.add)
microService.put('/', customerController.update)
microService.delete('/:id', customerController.deleteOneByID)