//Import modules
import {Model, ModelAttributes, DataTypes, Op as Operation} from 'sequelize';

export const Op: typeof Operation = Operation;

export default class RDBModel extends Model {

    /////////////////////////
    ///////Properties
    /////////////////////////
    public static _modelName(): string{
        return this.name.replace('Model', '');
    }

    public static _tableName(): string {
        return this.name.replace('Model', '').toLowerCase();
    }

    public static fields(dataTypes: typeof DataTypes): ModelAttributes {
        return null;
    }

    public static hooks() {}

    public static validations() {}

    public static associate() {}

    /////////////////////////
    ///////DAO's
    /////////////////////////
    //TODO: Need to remove this function in coming versions.
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

    //TODO: Add getOne and call findOne

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