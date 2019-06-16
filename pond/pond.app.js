//Import modules
import MicroService from '../mico_sdk/index'

//Local Imports
import PondController from './pond.controller'

//Init & start service
const microService = new MicroService({name: 'pond'});

const pondController = new PondController();
microService.get('/:id', pondController.selectOneByID);
microService.get('/', pondController.selectAll);
microService.post('/', pondController.add);
microService.put('/', pondController.update);
microService.delete('/:id', pondController.deleteOneByID);

microService.startService();