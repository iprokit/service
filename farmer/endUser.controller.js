//Import modules
import {Controller} from '../mico_sdk/dist/index'

//Import Local
import {default as EndUserModel} from './endUserModel'

export default class EndUserController extends Controller {
    //Default Constructor
    constructor() {
        super(EndUserModel);
    }

    selectOneByID(request, response) {
        super.selectOneByID(request, response);
    }

    selectAll(request, response) {
        super.selectAll(request, response);
    }

    selectAllAndOrderByCreatedAt(request, response) {
        super.selectAllAndOrderByCreatedAt(request, response);
    }

    add(request, response) {
        super.add(request, response);
    }

    update(request, response) {
        super.update(request, response);
    }

    deleteOneByID(request, response) {
        super.deleteOneByID(request, response);
    }
}
