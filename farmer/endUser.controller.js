//Import modules
import {Controller} from '../mico_sdk/dist/index'

//Import Local
import {sequelize} from '../mico_sdk/dist/app';

export default class EndUserController extends Controller {
    selectOneByID(request, response) {
        super.selectOneByID(sequelize.models.EndUser, request, response);
    }

    selectAll(request, response) {
        super.selectAll(sequelize.models.EndUser, request, response);
    }

    selectAllAndOrderByCreatedAt(request, response) {
        super.selectAllAndOrderByCreatedAt(sequelize.models.EndUser, request, response);
    }

    add(request, response) {
        super.add(sequelize.models.EndUser, request, response);
    }

    update(request, response) {
        super.update(sequelize.models.EndUser, request, response);
    }

    deleteOneByID(request, response) {
        super.deleteOneByID(sequelize.models.EndUser, request, response);
    }
}
