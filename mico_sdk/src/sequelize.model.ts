import {Model, ModelAttributes} from 'sequelize'

export default class SequelizeModel extends Model {
    static _modelName(): string{
        return this.name.replace('Model', '');
    }

    static _tableName(): string{
        //TODO: For every captital letter add _ before. Ex: EndUser = end_user
        return this.name.replace('Model', '').toLowerCase();
    }

    static fields(): ModelAttributes {
        return null;
    }

    static associate() {}
}
