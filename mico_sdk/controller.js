//Import modules
import httpStatus from 'http-status-codes'

//Init variables
var _model;

class Controller{
    //Default Constructor
    constructor(model){
        _model = model
    }

    selectOneByID(request, response){
        try {
            _model.findById(request.params.id)
                .then(data => { response.status(httpStatus.OK).send({status: true, data: data}) })
                .catch(error => { response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error }) })
        } catch (error) {
            console.log(error);
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error })
        }
    }

    selectAll(request, response){
        try {
            _model.findAll()
                .then(data => { response.status(httpStatus.OK).send({status: true, data: data}) })
                .catch(error => { response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error }) })
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error })
        }
    }

    add(request, response){
        try {
            _model.create(request.body)
                .then(() => { response.status(httpStatus.CREATED).send({ status: true, message: "Created!" }) })
                .catch(error => { response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error }) })
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error })
        }
    }

    update(request, response){
        try {
            _model.update(request.body, { where: { id: request.body.id } })
                .then(() => { response.status(httpStatus.OK).send({ status: true, data: { affectedRows : 1 } }) })
                .catch(error => { response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error }) })
        } catch (error) {
            res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error })
        }
    }

    deleteOneByID(request, response){
        try {
            _model.destroy({ where: { id: request.body.id } })
                .then(() => { response.status(httpStatus.OK).send({ status: true, message: "Deleted!" }) })
                .catch(error => { response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error }) })
        } catch (error) {
            res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error })
        }
    }
}

export default Controller;