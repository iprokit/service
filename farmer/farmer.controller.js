//Import modules
import {default as FarmerModel} from './farmer.model'
import MicroSDK from '@iprotechs/ipromicro'
let Controller = MicroSDK.Controller;

export default class FarmerController extends Controller {
    //Default Constructor
    constructor() {
        super(FarmerModel);
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
