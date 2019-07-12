//Import modules
import {Controller} from '../../../mico_sdk/dist/index'
import httpStatus from 'http-status-codes';

//Import Local
import EndUserModel from './endUser.model';
import CustomerModel from '../customer/customer.model';

export default class EndUserController extends Controller {
    constructor(){
        super(EndUserModel);
    }

    selectOneByID(request, response) {
        super.selectOneByID(EndUserModel, request, response);
    }

    selectAll(request, response) {
        super.selectAll(EndUserModel, request, response);
    }

    selectAllAndOrderByCreatedAt(request, response) {
        super.selectAllAndOrderByCreatedAt(EndUserModel, request, response);
    }

    add(request, response) {
        super.add(EndUserModel, request, response);
    }

    update(request, response) {
        super.update(EndUserModel, request, response);
    }

    deleteOneByID(request, response) {
        super.deleteOneByID(EndUserModel, request, response);
    }

    customerDetailsByID(request, response) {
        try {
            EndUserModel.findAll({
                include: [{
                    model: CustomerModel
                }]
            }).then(data => {
                response.status(httpStatus.OK).send({ status: true, data: data })
            })
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message })
        }
    }
}