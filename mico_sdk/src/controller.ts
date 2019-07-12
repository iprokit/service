//Import modules
import httpStatus from 'http-status-codes';
import { Request, Response } from 'express';

//Local Import
import SequelizeModel from './sequelize.model';

export default class Controller {
    model: typeof SequelizeModel;

    constructor(model: typeof SequelizeModel) {
        this.model = model;
    }

    selectOneByID(model: typeof SequelizeModel, request: Request, response: Response) {
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

    selectAll(model: typeof SequelizeModel, request: Request, response: Response) {
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

    selectAllAndOrderByCreatedAt(model: typeof SequelizeModel, request: Request, response: Response) {
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

    add(model: typeof SequelizeModel, request: Request, response: Response) {
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

    update(model: typeof SequelizeModel, request: Request, response: Response) {
        try {
            model.findByPk(request.body.id)
                .then(data => {
                    if (data) {
                        model.update(request.body, { where: { id: request.body.id } })
                            .then(() => {
                                response.status(httpStatus.OK).send({ status: true, message: "Updated Successfully" });
                            })
                            .catch((error: any) => {
                                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
                            });
                    }
                    else {
                        response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: "Id doesn't exist" });
                    }
                })
                .catch((error: any) => {
                    response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
                })
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    };

    deleteOneByID(model: typeof SequelizeModel, request: Request, response: Response) {
        try {
            model.findByPk(request.params.id)
                .then(data => {
                    if (data) {
                        model.destroy({ where: { id: request.params.id } })
                            .then(() => {
                                response.status(httpStatus.OK).send({ status: true, message: 'Deleted!' });
                            })
                            .catch((error: any) => {
                                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
                            });
                    }
                    else {
                        response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: "Invalid id" })
                    }
                })
                .catch((error: any) => {
                    response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
                })
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    };
}