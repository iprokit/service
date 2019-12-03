//Import modules
import {Model, DataTypes} from 'sequelize';

//Local Imports
import { EntityOptions } from './db.manager';

//Export model Types.
export const RDBTypes: typeof DataTypes = DataTypes;

export default class RDBModel extends Model {
    public static entityOptions: EntityOptions;

    /////////////////////////
    ///////Properties
    /////////////////////////
    public static associate() {}

    public static hooks() {}

    /////////////////////////
    ///////DAO's
    /////////////////////////
    public static async getAllOrderByCreatedAt(orderType: string){
        if(orderType === 'new'){
            return await this.findAll({order: [['createdAt', 'DESC']]});
        }else if(orderType === 'old'){
            return await this.findAll({order: [['createdAt', 'ASC']]});
        }
    }

    public static async getAll(){
        return await this.findAll();
    }

    //TODO: Add getRecord() and call findOne

    public static async getOneByID(id: any){
        return await this.findByPk(id)
            .then(async data => {
                if(data){
                    return data
                }else{
                    throw new Error('No records found!');
                }
            })
            .catch(error => {
                throw error;
            });
    }

    public static async updateOne(data: any, where: any){
        return await this.update(data, { where: where, individualHooks: true})
            .then(async affectedRows => {
                if (affectedRows[0] === 0 && affectedRows[1].length === 0) {
                    throw new Error('No records found!');
                }else{
                    return true;
                }
            })
            .catch(error => {
                throw error;
            });
    }

    public static async updateOneByID(id: any, data: any){
        return await this.updateOne(data, {id: id});
    }

    //TODO: Add deleteOne

    public static async deleteOneByID(id: any){
        return await this.destroy({where: { id: id }, individualHooks: true})
            .then(async affectedRows => {
                if(affectedRows === 0){
                    throw new Error('No records found!');
                }else{
                    return true;
                }
            })
            .catch(error => {
                throw error;
            });
    }

    //TODO: Add pagenations
}