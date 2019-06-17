import Sequelize from 'sequelize'
//Create Pond Model
const PondModel = Sequelize.define('customer_pond',{
    id: {
        type: Sequelize.INTEGER(6),
        primaryKey: true,
        autoIncrement: true
    },
    ciba_reg_num: {
        type: Sequelize.STRING(255),
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
    enduser_id: {
        type: Sequelize.INTEGER(6),
        references: {
            model: 'aqu_endusers',
            key: 'id'
        },
        allowNull: false
    },
    geo_location_id: {
        type: Sequelize.INTEGER(6),
        references: {
            model: 'aqu_geo_locations',
            key: 'id'
        },
        allowNull: false
    },
    name: {
        type: Sequelize.STRING(30),
        allowNull: true
    },
    pond_code: {
        type: Sequelize.STRING(30),
        allowNull: true
    },
    pond_size :{
        type: Sequelize.FLOAT,
        allowNull: true
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

export default PondModel;