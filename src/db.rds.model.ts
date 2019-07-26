//Import modules
import {Model, ModelAttributes, DataTypes, Op as Operation} from 'sequelize';

export const Op: typeof Operation = Operation;

export default class RDSModel extends Model {
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
    ///////DAO's
    /////////////////////////
    public static async getAll(){
        return await this.findAll({order: [['createdAt', 'ASC']]})
    }

    public static async getOneByID(id: any){
        return await this.findByPk(id);
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
