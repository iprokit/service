//Import modules
import httpStatus from 'http-status-codes';
import { Request, Response } from 'express';

export default class Controller {
    //Default Constructor
    public constructor(){}

    public getOneByID(model: any, request: Request, response: Response) {
        model.getOneByID(request.params.id)
            .then((data: any) => {
                response.status(httpStatus.OK).send({ status: true, data: data });
            })
            .catch((error: any) => {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
            });
    };

    public getAll(model: any, request: Request, response: Response) {
        model.getAll()
            .then((data: any) => {
                response.status(httpStatus.OK).send({ status: true, data: data });
            })
            .catch((error: any) => {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
            });
    };

    public getAllOrderByCreatedAt(model: any, request: Request, response: Response) {
        model.getAllOrderByCreatedAt(request.params.orderType)
            .then((data: any) => {
                response.status(httpStatus.OK).send({ status: true, data: data });
            })
            .catch((error: any) => {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
            });
    };

    public create(model: any, request: Request, response: Response) {
        model.create(request.body)
            .then(() => {
                response.status(httpStatus.CREATED).send({ status: true, message: 'Created!' });
            })
            .catch((error: any) => {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
            });
    };

    public updateOneByID(model: any, request: Request, response: Response) {
        model.updateOneByID(request.body.id, request.body)
            .then(() => {
                response.status(httpStatus.OK).send({ status: true, message: 'Updated!' });
            })
            .catch((error: any) => {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
            });
    };

    public deleteOneByID(model: any, request: Request, response: Response) {
        model.deleteOneByID(request.params.id)
            .then(() => {
                response.status(httpStatus.OK).send({ status: true, message: 'Deleted!' });
            })
            .catch((error: any) => {
                response.status(httpStatus.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
            });
    };
}