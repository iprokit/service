//Import modules
import httpStatus from 'http-status-codes';
import { Request, Response } from 'express';

//Local Import
import SequelizeModel from './sequelize.model';
import { Model } from 'sequelize';

export default class Controller {
    selectOneByID(model: any, request: Request, response: Response) {
        try {
            model.findByPk(request.params.id)
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

    selectAll(model: any, request: Request, response: Response) {
        try {
            model.findAll()
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

    selectAllAndOrderByCreatedAt(model: any, request: Request, response: Response) {
        try {
            model.findAll({
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

    add(model: any, request: Request, response: Response) {
        try {
            model.create(request.body)
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

    update(model: any, request: Request, response: Response) {
        try {
            model.update(request.body, { where: { id: request.body.id } })
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

    deleteOneByID(model: any, request: Request, response: Response) {
        try {
            model.destroy({ where: { id: request.params.id } })
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
}