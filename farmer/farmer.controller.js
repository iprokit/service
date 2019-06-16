//Import modules
import Controller from '../mico_sdk/controller'

//Local Imports
import FarmerModel from './farmer.model'

class FarmerController extends Controller{
    //Default Constructor
    constructor(){
        super(new FarmerModel());
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