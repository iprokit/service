//Import modules
import httpStatus from 'http-status-codes';
import { Request, Response } from 'express';
import { PathParams, RequestHandlerParams } from 'express-serve-static-core';

//Local Import
import RDSModel from './db.rds.model';

//Types: Endpoint
export type Endpoint = {
    method: 'get' | 'post' | 'put' | 'delete',
    url: PathParams,
    fn: RequestHandlerParams
}

export default class Controller {
    readonly name = this.constructor.name;

    /////////////////////////
    ///////Default Functions
    /////////////////////////
    public static baseURL(): PathParams{
        return ('/' + this.name.replace('Controller', '').toLowerCase());
    }

    /////////////////////////
    ///////Map Endpoints
    /////////////////////////
    public static mapDefaultEndpoints(): Array<Endpoint>{
        const baseURL = this.baseURL();

        return [
            {method: 'get', url: baseURL + '/:id', fn: this.getOneByID},
            {method: 'get', url: baseURL, fn: this.getAll},
            {method: 'get', url: baseURL + "/orderby/:orderType", fn: this.getAllOrderByCreatedAt},
            {method: 'post', url: baseURL, fn: this.create},
            {method: 'put', url: baseURL, fn: this.updateOneByID},
            {method: 'delete', url: baseURL + '/:id', fn: this.deleteOneByID}
        ]
    }

    public static mapCustomEndpoints(): Array<Endpoint>{
        return;
    }

    /////////////////////////
    ///////Default Endpoints
    /////////////////////////
    public static getOneByID(model: typeof RDSModel, request: Request, response: Response) {
        try {
            model.getOneByID(request.params.id)
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

    public static getAll(model: typeof RDSModel, request: Request, response: Response) {
        try {
            model.getAll()
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

    public static getAllOrderByCreatedAt(model: typeof RDSModel, request: Request, response: Response) {
        try {
            model.getAllOrderByCreatedAt(request.params.orderType)
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

    public static create(model: typeof RDSModel, request: Request, response: Response) {
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

    public static updateOneByID(model: typeof RDSModel, request: Request, response: Response) {
        try {
            model.updateOneByID(request.body.id, request.body)
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

    public static deleteOneByID(model: typeof RDSModel, request: Request, response: Response) {
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