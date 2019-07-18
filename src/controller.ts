//Import modules
import httpStatus from 'http-status-codes';
import { Request, Response } from 'express';

//Local Import
import SequelizeModel from './sequelize.model';

export default class Controller {
    readonly name = this.constructor.name;

    public static selectOneByID(model: typeof SequelizeModel, request: Request, response: Response) {
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

    public static selectAll(model: typeof SequelizeModel, request: Request, response: Response) {
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

    public static orderByCreatedAt(model: typeof SequelizeModel, request: Request, response: Response) {
        try {
            model.orderByCreatedAt(request.params.orderType)
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

    public static add(model: typeof SequelizeModel, request: Request, response: Response) {
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

    public static update(model: typeof SequelizeModel, request: Request, response: Response) {
        try {
            model.updateOneByID(request.body)
                .then(() => {
                    response.status(httpStatus.OK).send({ status: true, message: 'Updated!' });
                })
                .catch((error: any) => {
                    response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
                });
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    };

    public static deleteOneByID(model: typeof SequelizeModel, request: Request, response: Response) {
        try {
            model.deleteOneByID(request.params.id)
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