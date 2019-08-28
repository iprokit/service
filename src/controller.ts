//Import modules
import httpStatus from 'http-status-codes';
import { Request, Response } from 'express';

//Local Import
import RDBModel from './db.rdb.model';

export default class Controller {
    public constructor(){}

    public getOneByID(model: typeof RDBModel, request: Request, response: Response) {
        model.getOneByID(request.params.id)
            .then((data: any) => {
                response.status(httpStatus.OK).send({ status: true, data: data });
            })
            .catch((error: any) => {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
            });
    };

    public getAll(model: typeof RDBModel, request: Request, response: Response) {
        model.getAll()
            .then((data: any) => {
                response.status(httpStatus.OK).send({ status: true, data: data });
            })
            .catch((error: any) => {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
            });
    };

    public getAllOrderByCreatedAt(model: typeof RDBModel, request: Request, response: Response) {
        model.getAllOrderByCreatedAt(request.params.orderType)
            .then((data: any) => {
                response.status(httpStatus.OK).send({ status: true, data: data });
            })
            .catch((error: any) => {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
            });
    };

    public create(model: typeof RDBModel, request: Request, response: Response) {
        model.create(request.body)
            .then(() => {
                response.status(httpStatus.CREATED).send({ status: true, message: 'Created!' });
            })
            .catch((error: any) => {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
            });
    };

    public updateOneByID(model: typeof RDBModel, request: Request, response: Response) {
        model.updateOneByID(request.body.id, request.body)
            .then(() => {
                response.status(httpStatus.OK).send({ status: true, message: 'Updated!' });
            })
            .catch((error: any) => {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
            });
    };

    public deleteOneByID(model: typeof RDBModel, request: Request, response: Response) {
        model.deleteOneByID(request.params.id)
            .then(() => {
                response.status(httpStatus.OK).send({ status: true, message: 'Deleted!' });
            })
            .catch((error: any) => {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
            });
    };
}