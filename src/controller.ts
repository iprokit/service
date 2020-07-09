//Import Modules
import { Request, Response } from 'express';

//Local Imports
import { Model } from './db.manager';
import { FindOrder } from './db.model';
import HttpStatusCodes from './http.statusCodes';

/**
 * This generic `Controller` is responsible for handling incoming `Requests` and returning `Responses`.
 * It performs operations on the binded `Model`:
 * - Create - Creates a new record on the `Model`.
 * - getAll - Get all records on the `Model`.
 * - getOneByID - Get one record by `id` on the `Model`.
 * - updateOneByID - Update one record by `id` on the `Model`.
 * - deleteOneByID - Delete one record by `id` on the `Model`.
 */
export default class Controller {
    /**
     * The model to perform operation on.
     */
    public readonly model: Model;

    /**
     * Creates an instance of a `Controller`.
     * 
     * @param model the model to perform operation on.
     */
    constructor(model: Model) {
        this.model = model;
    }

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
     * @param request the http request.
     * @param response the http response.
     */
    public async create(request: Request, response: Response) {
        try {
            await (this.model as any).create(request.body);
            response.status(HttpStatusCodes.CREATED).send({ status: true, message: 'Created!' });
        } catch (error) {
            response.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    }

    /**
     * Performs asynchronous, get all records on the `Model`.
     * 
     * @param request the http request.
     * @param response the http response.
     */
    public async getAll(request: Request, response: Response) {
        try {
            const data = await this.model.getAll({
                order: request.query.order as FindOrder,
                pagination: {
                    page: Number(request.query.page),
                    size: Number(request.query.pageSize)
                }
            });
            response.status(HttpStatusCodes.OK).send({ status: true, data: data });
        } catch (error) {
            response.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    }

    /**
     * Performs asynchronous, get one record by `id` on the `Model`.
     * 
     * @param request the http request.
     * @param response the http response.
     */
    public async getOneByID(request: Request, response: Response) {
        try {
            const data = await this.model.getOneByID(request.params.id);
            response.status(HttpStatusCodes.OK).send({ status: true, data: data });
        } catch (error) {
            response.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    }

    /**
     * Performs asynchronous, update one record by `id` on the `Model`.
     * 
     * @param request the http request.
     * @param response the http response.
     */
    public async updateOneByID(request: Request, response: Response) {
        try {
            await this.model.updateOneByID(request.params.id, request.body);
            response.status(HttpStatusCodes.OK).send({ status: true, message: 'Updated!' });
        } catch (error) {
            response.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    }

    /**
     * Performs asynchronous, delete one record by `id` on the `Model`.
     * 
     * @param request the http request.
     * @param response the http response.
     */
    public async deleteOneByID(request: Request, response: Response) {
        try {
            await this.model.deleteOneByID(request.params.id);
            response.status(HttpStatusCodes.OK).send({ status: true, message: 'Deleted!' });
        } catch (error) {
            response.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    }
}