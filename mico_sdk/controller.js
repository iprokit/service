//Import modules
import Model from './model'
import httpStatus from 'http-status-codes'

//Init variables
var _model;

class Controller{
    //Default Constructor
    constructor(model){
        if(model instanceof Model){
            _model = model;
        }else{
            throw new Error("%s should be an instance of Model.", model.constructor.name);
        }
    }

    selectOneByID(request, response){
        try {
            _model.getSchema().findByPk(request.params.id)
                .then(data => { response.status(httpStatus.OK).send({status: true, data: data}) })
                .catch(error => { response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message }) })
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message })
        }
    }

    selectAll(request, response){
        try {
            _model.getSchema().findAll()
                .then(data => { response.status(httpStatus.OK).send({status: true, data: data}) })
                .catch(error => { response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message }) })
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message })
        }
    }

    add(request, response){
        try {
            _model.getSchema().create(request.body)
                .then(() => { response.status(httpStatus.CREATED).send({ status: true, message: "Created!" }) })
                .catch(error => { response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message }) })
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message })
        }
    }

    update(request, response){
        try {
            _model.getSchema().update(request.body, { where: { id: request.body.id } })
                .then(() => { response.status(httpStatus.OK).send({ status: true, data: { affectedRows : 1 } }) })
                .catch(error => { response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message }) })
        } catch (error) {
            res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message })
        }
    }

    deleteOneByID(request, response){
        try {
            _model.getSchema().destroy({ where: { id: request.params.id } })
                .then(() => { response.status(httpStatus.OK).send({ status: true, message: "Deleted!" }) })
                .catch(error => { response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message }) })
        } catch (error) {
            res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message })
        }
    }
}

export default Controller;