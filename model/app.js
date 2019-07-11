import {Sequelize, Model, DataTypes} from 'sequelize';
import customer from './customer';

export const sequelize = new Sequelize('CUSTOMER_DB', 'varaaqu', 'ipro2019', {
    host: 'ec2-13-234-76-76.ap-south-1.compute.amazonaws.com',
    dialect: 'mysql',
    operatorsAliases: false,
    timezone: '+5:30'
});

//const customer = require('./customer').default;
var fields = customer.fields();
var model = Model.init(fields, {sequelize, modelName: 'Customer', tableName: 'aqu_customer'});

model.findAll()
    .then((data) => {
        console.log("data", data)
    })
    .catch((error) => {
        console.log("error", error)
    });

sequelize.authenticate()
    .then(() => {
        console.log('Connected to DB');
    })
    .catch((error) => {
        console.error('Unable to connect to the database:', error);
    });