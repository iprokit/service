//Import modules
import httpStatus from 'http-status-codes';
import { Request, Response } from 'express';

//Local Import
import { sequelize } from './app';

//var model:any
export default class Controller {
    //Default Constructor
    // constructor(_model: any) {
    //     model = _model;
    // }

    selectOneByID(request: Request, response: Response) {
        console.log("this.getModel()", this.getModel())
        try {
            this.getModel().findByPk(request.params.id)
                .then((data: any) => {
                    response.status(httpStatus.OK).send({ status: true, data: data });
                })
                .catch((error: any) => {
                    response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
                });
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    };

    selectAll(request: Request, response: Response) {
        try {
            this.getModel().findAll()
                .then((data: any) => {
                    response.status(httpStatus.OK).send({ status: true, data: data });
                })
                .catch((error: any) => {
                    response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
                });
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    };

    selectAllAndOrderByCreatedAt(request: Request, response: Response) {
        try {
            this.getModel().findAll({
                order: [['createdAt', 'DESC']]
            })
                .then((data: any) => {
                    response.status(httpStatus.OK).send({ status: true, data: data });
                })
                .catch((error: any) => {
                    response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
                });
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    };

    add(request: Request, response: Response) {
        try {
            this.getModel().create(request.body)
                .then(() => {
                    response.status(httpStatus.CREATED).send({ status: true, message: 'Created!' });
                })
                .catch((error: any) => {
                    response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
                });
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    };

    update(request: Request, response: Response) {
        try {
            this.getModel().update(request.body, { where: { id: request.body.id } })
                .then(() => {
                    response.status(httpStatus.OK).send({ status: true, data: { affectedRows: 1 } });
                })
                .catch((error: any) => {
                    response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
                });
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    };

    deleteOneByID(request: Request, response: Response) {
        try {
            this.getModel().destroy({ where: { id: request.params.id } })
                .then(() => {
                    response.status(httpStatus.OK).send({ status: true, message: 'Deleted!' });
                })
                .catch((error: any) => {
                    response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
                });
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    };

    getModel(): any {
        var models: any = []
        models.push(sequelize.models)
        let classname = this.constructor.name.slice(0, -10)
        //need to validate classname and models 
        return classname
       }

    getName() {
        return this.getModel();
    }
}