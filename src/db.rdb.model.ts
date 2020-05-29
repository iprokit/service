//Import modules
import { Model, Order } from 'sequelize';

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
     * @alias `model.findAll()`
     */
    public static async getAll(options: FindOptions) {
        let order: Order;

        if (options.order === 'new') {
            order = [['createdAt', 'DESC']];
        } else if (options.order === 'old') {
            order = [['createdAt', 'ASC']];
        }

        return await this.findAll({ order: order });
    }

    /**
     * Performs asynchronous, get one record by `model.id`.
     * 
     * @param id the record to retrieve by id.
     * 
     * @returns the record found.
     * 
     * @throws `Error` if no records found.
     * 
     * @alias `model.findByPk()`
     */
    public static async getOneByID(id: any) {
        return await this.findByPk(id)
            .then(async data => {
                if (data) {
                    return data
                } else {
                    throw new Error('No records found!');
                }
            })
            .catch(error => {
                throw error;
            });
    }

    /**
     * Performs asynchronous, update one record by `model.id`.
     * 
     * @param id the record to update by id.
     * @param values the values of the record.
     * 
     * @returns `true` if the record is successfully updated.
     * 
     * @throws error if the update failed. Due to, no record found.
     * 
     * @alias `model.update()`
     */
    public static async updateOneByID(id: any, values: any) {
        return await this.update(values, { where: { id: id }, individualHooks: true })
            .then(async affectedRows => {
                if (affectedRows[0] === 0 && affectedRows[1].length === 0) {
                    throw new Error('No records found!');
                } else {
                    return true;
                }
            })
            .catch(error => {
                throw error;
            });
    }

    /**
     * Performs asynchronous, delete one record by `model.id`.
     * 
     * @param id the record to delete by id.
     * 
     * @returns `true` if the record is successfully deleted.
     * 
     * @throws error if the delete failed. Due to, no record found.
     * 
     * @alias `model.update()`
     */
    public static async deleteOneByID(id: any) {
        return await this.destroy({ where: { id: id }, individualHooks: true })
            .then(async affectedRows => {
                if (affectedRows === 0) {
                    throw new Error('No records found!');
                } else {
                    return true;
                }
            })
            .catch(error => {
                throw error;
            });
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

//////////////////////////////
//////Type Definitions
//////////////////////////////
/**
 * The find options for `model.find()`.
 */
export type FindOptions = {
    /**
     * Order all the records by `model.createdAt`.
     * Set to `new` if latest records should be on the top,
     * `old` if latest records should be at the bottom.
     */
    order: 'new' | 'old'
}