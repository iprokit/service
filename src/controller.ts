//Import modules
import { Request, Response } from 'express';

//Local Imports
import { HttpCodes } from './www';

export default class Controller {
    //Default Constructor
    constructor(){}

    //Get Name
    get name(){
        return this.constructor.name;
    }

    public create(model: any, request: Request, response: Response) {
        model.create(request.body)
            .then(() => {
                response.status(HttpCodes.CREATED).send({ status: true, message: 'Created!' });
            })
            .catch((error: any) => {
                response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
            });
    };

    public getAll(model: any, request: Request, response: Response) {
        model.getAll()
            .then((data: any) => {
                response.status(HttpCodes.OK).send({ status: true, data: data });
            })
            .catch((error: any) => {
                response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
            });
    };

    public getAllOrderByCreatedAt(model: any, request: Request, response: Response) {
        model.getAllOrderByCreatedAt(request.params.orderType)
            .then((data: any) => {
                response.status(HttpCodes.OK).send({ status: true, data: data });
            })
            .catch((error: any) => {
                response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
            });
    };

    public getOneByID(model: any, request: Request, response: Response) {
        model.getOneByID(request.params.id)
            .then((data: any) => {
                response.status(HttpCodes.OK).send({ status: true, data: data });
            })
            .catch((error: any) => {
                response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
            });
    };

    public updateOneByID(model: any, request: Request, response: Response) {
        model.updateOneByID(request.body.id, request.body)
            .then(() => {
                response.status(HttpCodes.OK).send({ status: true, message: 'Updated!' });
            })
            .catch((error: any) => {
                response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
            });
    };

    public deleteOneByID(model: any, request: Request, response: Response) {
        model.deleteOneByID(request.params.id)
            .then(() => {
                response.status(HttpCodes.OK).send({ status: true, message: 'Deleted!' });
            })
            .catch((error: any) => {
                response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
            });
    };
}