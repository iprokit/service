//Import modules
import {Model, ModelAttributes, DataTypes, Op as Operation} from 'sequelize';

export const Op: typeof Operation = Operation;

export default class SequelizeModel extends Model {
    public static _modelName(): string{
        return this.name.replace('Model', '');
    }

    public static _tableName(): string{
        //TODO: For every captital letter add _ before. Ex: EndUser = end_user
        return this.name.replace('Model', '');
    }

    public static fields(dataTypes: typeof DataTypes): ModelAttributes {
        return null;
    }

    public static hooks() {}

    public static associate() {}

    /////////////////////////
    ///////DAO Functions
    /////////////////////////
    public static async orderByCreatedAt(orderType: string){
        if(orderType === 'new'){
            return await this.findAll({order: [['createdAt', 'DESC']]});
        }else if(orderType === 'old'){
            return await this.findAll({order: [['createdAt', 'ASC']]});
        }else{
            throw new Error('Invalid Order Type!');
        }
    }

    public static async updateOne(data: any, where: any){
        await this.update(data, { where: where, individualHooks: true})
            .then(async affectedRows => {
                if(affectedRows[0] === 0){
                    throw new Error('ID does not exit!');
                }else{
                    return;
                }
            })
            .catch(error => {
                throw error;
            });
    }

    public static async updateOneByID(data: any){
        await this.updateOne(data, {id: data.id});
    }

    public static async deleteOneByID(id: any){
        await this.destroy({where: { id: id }})
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
}
