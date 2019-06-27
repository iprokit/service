//Import modules
import Model from './model';
import httpStatus from 'http-status-codes';

//Init variables

class Controller {
    _model: any;

    //Default Constructor
    constructor(model: any) {
        if (model instanceof Model) {
            this._model = model;
        } else {
            throw new Error('%s should be an instance of Model.' + ' ' + model.constructor.name);
        }
    }

    selectOneByID(request: any, response: any) {
        try {
            this._model.getSchema().findByPk(request.params.id)
                .then((data: any) => {
                    response.status(httpStatus.OK).send({status: true, data: data});
                })
                .catch((error: any) => {
                    response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
                });
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
        }
    }

    selectAll(request: any, response: any) {
        try {
            this._model.getSchema().findAll()
                .then((data: any) => {
                    response.status(httpStatus.OK).send({status: true, data: data});
                })
                .catch((error: any) => {
                    response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
                });
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
        }
    }

    add(request: any, response: any) {
        try {
            this._model.getSchema().create(request.body)
                .then(() => {
                    response.status(httpStatus.CREATED).send({status: true, message: 'Created!'});
                })
                .catch((error: any) => {
                    response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
                });
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
        }
    }

    update(request: any, response: any) {
        try {
            this._model.getSchema().update(request.body, {where: {id: request.body.id}})
                .then(() => {
                    response.status(httpStatus.OK).send({status: true, data: {affectedRows: 1}});
                })
                .catch((error: any) => {
                    response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
                });
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
        }
    }

    deleteOneByID(request: any, response: any) {
        try {
            this._model.getSchema().destroy({where: {id: request.params.id}})
                .then(() => {
                    response.status(httpStatus.OK).send({status: true, message: 'Deleted!'});
                })
                .catch((error: any) => {
                    response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
                });
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
        }
    }
}

export default Controller;
