//Import modules
import {Controller} from '../mico_sdk/dist/index'

//Import Local
import EndUserModel from './endUserModel';

export default class EndUserController extends Controller {
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
}
