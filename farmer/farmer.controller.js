import Controller from '../mico_sdk/controller'

class FarmerController extends Controller{
    //Default Constructor
    constructor(farmerModel){
        super(farmerModel);
    }
    selectOneByID(request, response){
        super.selectOneByID(request, response);
    }
    selectAll(request, response){
        super.selectAll(request, response);
    }
    add(request, response){
        super.add(request, response);
    }
    update(request, response){
        super.update(request, response);
    }
    deleteOneByID(request, response){
        super.deleteOneByID(request, response);
    }
}

export default FarmerController;