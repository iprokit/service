//Import modules
import { Request, Response } from 'express';
import HttpCodes from 'http-status-codes';

/**
 * This generic `Controller` is responsible for handling incoming `Requests` and returning `Responses` to the client.
 */
export default class Controller {
    public readonly model: any;
    /**
     * Creates an instance of a `Controller`.
     */
    constructor(model: any) {
        this.model = model;
    }

    /**
     * Performs asynchronous, get all records on the `Model`.
     * 
     * @param request the http request.
     * @param response the http response.
     */
    public async test(request: Request, response: Response) {
        try {
            const data = await this.model.getAll();
            response.status(HttpCodes.OK).send({ status: true, data: data });
        } catch (error) {
            response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    };

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    /**
     * The name of the `Controller`.
     */
    get name() {
        return this.constructor.name;
    }

    //////////////////////////////
    //////CRUD Operations
    //////////////////////////////
    /**
     * Perform asynchronous, create a new record on the `Model`.
     * 
     * @param model the model to perform the operation on.
     * @param request the http request.
     * @param response the http response.
     */
    public async create(model: any, request: Request, response: Response) {
        try {
            await model.create(request.body);
            response.status(HttpCodes.CREATED).send({ status: true, message: 'Created!' });
        } catch (error) {
            response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    };

    /**
     * Performs asynchronous, get all records on the `Model`.
     * 
     * @param model the model to perform the operation on.
     * @param request the http request.
     * @param response the http response.
     */
    public async getAll(model: any, request: Request, response: Response) {
        try {
            const data = await model.getAll();
            response.status(HttpCodes.OK).send({ status: true, data: data });
        } catch (error) {
            response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    };

    /**
     * Performs asynchronous, get all records by `model.createdAt` on the`Model`.
     * 
     * The `request.params.orderType` types:
     * @type new(DESC) - The lastest records will be on the top.
     * @type old(ASC) - The lastest records will be at the bottom.
     * 
     * @param model the model to perform the operation on.
     * @param request the http request.
     * @param response the http response.
     */
    public async getAllOrderByCreatedAt(model: any, request: Request, response: Response) {
        try {
            const data = await model.getAllOrderByCreatedAt(request.params.orderType);
            response.status(HttpCodes.OK).send({ status: true, data: data });
        } catch (error) {
            response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    };

    /**
     * Performs asynchronous, get one record by `model.id` on the `Model`.
     * 
     * @param model the model to perform the operation on.
     * @param request the http request.
     * @param response the http response.
     */
    public async getOneByID(model: any, request: Request, response: Response) {
        try {
            const data = await model.getOneByID(request.params.id);
            response.status(HttpCodes.OK).send({ status: true, data: data });
        } catch (error) {
            response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    };

    /**
     * Performs asynchronous, update one record by `model.id` on the `Model`.
     * 
     * @param model the model to perform the operation on.
     * @param request the http request.
     * @param response the http response.
     */
    public async updateOneByID(model: any, request: Request, response: Response) {
        try {
            await model.updateOneByID(request.body.id, request.body);
            response.status(HttpCodes.OK).send({ status: true, message: 'Updated!' });
        } catch (error) {
            response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    };

    /**
     * Performs asynchronous, delete one record by `model.id` on the `Model`.
     * 
     * @param model the model to perform the operation on.
     * @param request the http request.
     * @param response the http response.
     */
    public async deleteOneByID(model: any, request: Request, response: Response) {
        try {
            await model.deleteOneByID(request.params.id);
            response.status(HttpCodes.OK).send({ status: true, message: 'Deleted!' });
        } catch (error) {
            response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    };
}