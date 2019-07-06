//Import modules
import httpStatus from 'http-status-codes';
import {Controller} from '../mico_sdk/dist/index'

//Import Local
import {sequelize} from '../mico_sdk/dist/app';

export default class CustomerController extends Controller {
    selectOneByID(request, response) {
        super.selectOneByID(sequelize.models.Customer, request, response);
    }

    selectAll(request, response) {
        super.selectAll(sequelize.models.Customer, request, response);
    }

    selectAllAndOrderByCreatedAt(request, response) {
        super.selectAllAndOrderByCreatedAt(sequelize.models.Customer, request, response);
    }

    add(request, response) {
        super.add(sequelize.models.Customer, request, response);
    }

    update(request, response) {
        super.update(sequelize.models.Customer, request, response);
    }

    deleteOneByID(request, response) {
        super.deleteOneByID(sequelize.models.Customer, request, response);
    }
    
    findAllFarmers(request, response) {
        try {
            sequelize.models.Customer.findAll({
                include: [{
                    model: sequelize.models.EndUser
                }]
            }).then(data => {
                response.status(httpStatus.OK).send({ status: true, data: data })
            })
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message })
        }
    }
}
