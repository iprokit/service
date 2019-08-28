//Import modules
import {Model, ModelAttributes, DataTypes, Op as Operation} from 'sequelize';

export const Op: typeof Operation = Operation;

export default class RDBModel extends Model {
    public static _modelName(): string{
        return this.name.replace('Model', '');
    }

    public static _tableName(): string {
        //TODO: For every captital letter add _ before. Ex: EndUser = end_user
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

    public static async getOneByID(id: any){
        return await this.findByPk(id);
    }

    public static async updateOne(data: any, where: any){
        await this.update(data, { where: where, individualHooks: true})
            .then(async affectedRows => {
                if (affectedRows[0] === 0 && affectedRows[1].length === 0) {
                    throw new Error('ID does not exit!');
                }else{
                    return;
                }
            })
            .catch(error => {
                throw error;
            });
    }

    public static async updateOneByID(id: any, data: any){
        await this.updateOne(data, {id: id});
    }

    public static async deleteOneByID(id: any){
        await this.destroy({where: { id: id }, individualHooks: true})
            .then(async affectedRows => {
                if(affectedRows === 0){
                    throw new Error('ID does not exit!');
                }else{
                    return;
                }
            })
            .catch(error => {
                throw error;
            });
    }

    //TODO: Throw data validation errors in insert and update.
}
