import Sequelize from 'sequelize'
//Import modules
import MicroService from '../mico_sdk/index'
//Init & start service
const microService = new MicroService();
const FarmerModel = microService.sequelize.define('farmer',{
    id: {
        type: Sequelize.INTEGER(6),
        primaryKey: true,
        autoIncrement: true
    },
    first_name: {
        type: Sequelize.STRING(20),
        allowNull: false
    },
    last_name: {
        type: Sequelize.STRING(20),
        allowNull: true
    },
    latitude: {
        type: Sequelize.FLOAT,
        allowNull: false
    },
    longitude: {
        type: Sequelize.FLOAT,
        allowNull: false
    },
    address1: {
        type: Sequelize.INTEGER(6),
        references: {
            model: 'aqu_addresses',
            key: 'id'
        },
        allowNull: true
    },
    address2: {
        type: Sequelize.INTEGER(6),
        references: {
            model: 'aqu_addresses',
            key: 'id'
        },
        allowNull: true
    },
    phone1: {
        type: Sequelize.STRING(15),
        allowNull: false,
        unique: true
    },
    phone2: {
        type: Sequelize.STRING(15),
        allowNull: true
    },
    email: {
        type: Sequelize.STRING(30),
        allowNull: true
    },
    username: {
        type: Sequelize.STRING(30),
        allowNull: true
    },
    password: {
        type: Sequelize.STRING(50),
        allowNull: false
    },
    customer_id: {
        type: Sequelize.INTEGER(6),
        references: {
            model: 'aqu_customers',
            key: 'id'
        },
        allowNull: false
    },
    user_id:{
        type: Sequelize.INTEGER(6),
        references: {
            model: 'aqu_users',
            key: 'id'
        },
        allowNull: true
    },
    isActive: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
        default :1
    },
    created_by: {
        type: Sequelize.INTEGER(6),
        references: {
            model: 'aqu_users',
            key: 'id'
        },
        allowNull: true
    },
    updated_by: {
        type: Sequelize.INTEGER(6),
        references: {
            model: 'aqu_users',
            key: 'id'
        },
        allowNull: true
    }
})
export default FarmerModel;