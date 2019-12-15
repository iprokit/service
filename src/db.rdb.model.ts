//Import modules
import {Model, ModelAttributes} from 'sequelize';

export default class RDBModel extends Model {
    public static entityName: string;
    public static entityAttributes: ModelAttributes;

    /////////////////////////
    ///////DAO's - Basic
    /////////////////////////
    public static async getAll(){
        return await this.findAll();
    }

    public static async getAllOrderByCreatedAt(orderType: string){
        if(orderType === 'new'){
            return await this.findAll({order: [['createdAt', 'DESC']]});
        }else if(orderType === 'old'){
            return await this.findAll({order: [['createdAt', 'ASC']]});
        }
    }

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

    public static async updateOneByID(id: any, data: any){
        return await this.update(data, {where: {id: id}, individualHooks: true})
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

    /////////////////////////
    ///////Properties
    /////////////////////////
    public static hooks() {}

    public static associate() {}
}

//TODO: Implement pagenation