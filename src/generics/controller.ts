//Import modules
import { Request, Response } from 'express';

//Local Imports
import { HttpCodes } from '../components/api.server';

export default class Controller {
    //Default Constructor
    constructor() { }

    //Get Name
    get name() {
        return this.constructor.name;
    }

    public async create(model: any, request: Request, response: Response) {
        try {
            await model.create(request.body);
            response.status(HttpCodes.CREATED).send({ status: true, message: 'Created!' });
        } catch (error) {
            response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    };

    public async getAll(model: any, request: Request, response: Response) {
        try {
            const data = await model.getAll();
            response.status(HttpCodes.OK).send({ status: true, data: data });
        } catch (error) {
            response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    };

    public async getAllOrderByCreatedAt(model: any, request: Request, response: Response) {
        try {
            const data = await model.getAllOrderByCreatedAt(request.params.orderType);
            response.status(HttpCodes.OK).send({ status: true, data: data });
        } catch (error) {
            response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    };

    public async getOneByID(model: any, request: Request, response: Response) {
        try {
            const data = await model.getOneByID(request.params.id);
            response.status(HttpCodes.OK).send({ status: true, data: data });
        } catch (error) {
            response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    };

    public async updateOneByID(model: any, request: Request, response: Response) {
        try {
            await model.updateOneByID(request.body.id, request.body);
            response.status(HttpCodes.OK).send({ status: true, message: 'Updated!' });
        } catch (error) {
            response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    };

    public async deleteOneByID(model: any, request: Request, response: Response) {
        try {
            await model.deleteOneByID(request.params.id);
            response.status(HttpCodes.OK).send({ status: true, message: 'Deleted!' });
        } catch (error) {
            response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    };
}