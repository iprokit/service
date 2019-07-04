//Import modules
import Model from './sequelize.model';
import httpStatus from 'http-status-codes';

//Init variables
var model: Model;

export default class Controller {
    //Default Constructor
    constructor(_model: Model) {
        model = _model;
    }

    selectOneByID(request: any, response: any){
        try {
            model.getSchema().findByPk(request.params.id)
                .then((data: any) => {
                    response.status(httpStatus.OK).send({status: true, data: data});
                })
                .catch((error: any) => {
                    response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
                });
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
        }
    };

    selectAll(request: any, response: any){
        try {
            model.getSchema().findAll()
                .then((data: any) => {
                    response.status(httpStatus.OK).send({status: true, data: data});
                })
                .catch((error: any) => {
                    response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
                });
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
        }
    };

    selectAllByDesc(request: any, response: any){
        try {
            model.getSchema().findAll({
                order: [['createdAt', 'DESC']]
            })
                .then((data: any) => {
                    response.status(httpStatus.OK).send({status: true, data: data});
                })
                .catch((error: any) => {
                    response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
                });
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
        }
    };

    add(request: any, response: any){
        try {
            model.getSchema().create(request.body)
                .then(() => {
                    response.status(httpStatus.CREATED).send({status: true, message: 'Created!'});
                })
                .catch((error: any) => {
                    response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
                });
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
        }
    };

    update(request: any, response: any){
        try {
            model.getSchema().update(request.body, {where: {id: request.body.id}})
                .then(() => {
                    response.status(httpStatus.OK).send({status: true, data: {affectedRows: 1}});
                })
                .catch((error: any) => {
                    response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
                });
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
        }
    };

    deleteOneByID(request: any, response: any){
        try {
            model.getSchema().destroy({where: {id: request.params.id}})
                .then(() => {
                    response.status(httpStatus.OK).send({status: true, message: 'Deleted!'});
                })
                .catch((error: any) => {
                    response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
                });
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
        }
    };
}