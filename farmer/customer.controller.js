//Import modules
import httpStatus from 'http-status-codes';
import {Controller} from '../mico_sdk/dist/index'

//Import Local
import CustomerModel from './customer.model';
import EndUserModel from './endUser.model';

export default class CustomerController extends Controller {
    constructor(){
        super(CustomerModel);
    }

    selectOneByID(request, response) {
        super.selectOneByID(CustomerModel, request, response);
    }

    selectAll(request, response) {
        super.selectAll(CustomerModel, request, response);
    }

    selectAllAndOrderByCreatedAt(request, response) {
        super.selectAllAndOrderByCreatedAt(CustomerModel, request, response);
    }

    add(request, response) {
        super.add(CustomerModel, request, response);
    }

    update(request, response) {
        super.update(CustomerModel, request, response);
    }

    deleteOneByID(request, response) {
        super.deleteOneByID(CustomerModel, request, response);
    }
    
    findAllFarmers(request, response) {
        try {
            CustomerModel.findAll({
                include: [{
                    model: EndUserModel
                }]
            }).then(data => {
                response.status(httpStatus.OK).send({ status: true, data: data })
            })
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message })
        }
    }
}
