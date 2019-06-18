//Import modules
import httpStatus from 'http-status-codes'

//Init variables
var model;

class Controller{
    //Default Constructor
    constructor(modelObject){
        model = modelObject
    }

    selectOneByID(request, response){
        try {
            model.findById(request.params.id)
                .then(data => { response.status(httpStatus.OK).send({status: true, data: data}) })
                .catch(error => { response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message }) })
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message })
        }
    }

    selectAll(request, response){
        try {
            model.findAll()
                .then(data => { response.status(httpStatus.OK).send({status: true, data: data}) })
                .catch(error => { response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message }) })
        } catch (error) {
            console.log(error);
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message })
        }
    }

    add(request, response){
        try {
            model.create(request.body)
                .then(() => { response.status(httpStatus.CREATED).send({ status: true, message: "Created!" }) })
                .catch(error => { response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message }) })
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message })
        }
    }

    update(request, response){
        try {
            model.update(request.body, { where: { id: request.body.id } })
                .then(() => { response.status(httpStatus.OK).send({ status: true, data: { affectedRows : 1 } }) })
                .catch(error => { response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message }) })
        } catch (error) {
            res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message })
        }
    }

    deleteOneByID(request, response){
        try {
            model.destroy({ where: { id: request.body.id } })
                .then(() => { response.status(httpStatus.OK).send({ status: true, message: "Deleted!" }) })
                .catch(error => { response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message }) })
        } catch (error) {
            res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message })
        }
    }
}

export default Controller;