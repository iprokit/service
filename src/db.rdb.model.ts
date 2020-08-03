//Import modules
import { Model, ModelAttributes, DataTypes, Op, Order } from 'sequelize';

//Local Imports
import model, { FindOptions } from './db.model';

//Export Libs
export { ModelAttributes as RDBModelAttributes, DataTypes as RDBDataTypes, Op as RDBOp }

/**
 * A generic `RDBModel` is an instance of `Sequelize` model.
 */
export default class RDBModel extends Model {
    //////////////////////////////
    //////DAO's
    //////////////////////////////
    /**
     * Performs asynchronous, get all records.
     * 
     * @param options the optional find options.
     * 
     * @returns all the records.
     * 
     * @default 
     * options = { order: 'new', pagination: { page: 0, size: 20 } };
     * 
     * 
     * @alias `model.findAll()`
     */
    public static async getAll(options?: FindOptions) {
        let order: Order;

        //Initialize Options.
        options = options ?? {};
        options.pagination = options.pagination ?? {};

        //Order properties.
        if (options.order === 'new' || !options.order) {
            order = [['createdAt', 'DESC']];
        } else if (options.order === 'old') {
            order = [['createdAt', 'ASC']];
        }

        //Pagination properties.
        const page = model.pagination(options.pagination.page, options.pagination.size);

        return await this.findAll({ order: order, offset: page.offset, limit: page.limit, raw: true });
    }

    /**
     * Performs asynchronous, get one record by `model.id`.
     * 
     * @param id the record to retrieve by id.
     * 
     * @returns the record found, undefined otherwise.
     * 
     * @alias `model.findByPk()`
     */
    public static async getOneByID(id: any) {
        return await this.findByPk(id, { raw: true }) ?? undefined;
    }

    /**
     * Performs asynchronous, update one record by `model.id`.
     * 
     * @param id the record to update by id.
     * @param values the values of the record.
     * 
     * @returns true if the record is successfully updated, false otherwise.
     * 
     * @alias `model.update()`
     */
    public static async updateOneByID(id: any, values: any) {
        const affectedRecords = await this.update(values, { where: { id: id }, individualHooks: true });

        if (affectedRecords[0] === 0 && affectedRecords[1].length === 0) {
            return false;
        } else {
            return true;
        }
    }

    /**
     * Performs asynchronous, delete one record by `model.id`.
     * 
     * @param id the record to delete by id.
     * 
     * @returns true if the record is successfully deleted, false otherwise.
     * 
     * @alias `model.update()`
     */
    public static async deleteOneByID(id: any) {
        const affectedRecords = await this.destroy({ where: { id: id }, individualHooks: true });

        if (affectedRecords === 0) {
            return false;
        } else {
            return true;
        }
    }

    //////////////////////////////
    //////Properties
    //////////////////////////////
    /**
     * Wrapper to declare hooks.
     */
    public static hooks() { }

    /**
     * Wrapper to declare associations.
     */
    public static associate() { }
}