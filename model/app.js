import { Sequelize, Model, DataTypes } from 'sequelize';
import customer from './customer';
import endUser from './enduser'

export const sequelize = new Sequelize('CUSTOMER_DB', 'varaaqu', 'ipro2019', {
    host: 'ec2-13-234-76-76.ap-south-1.compute.amazonaws.com',
    dialect: 'mysql',
    operatorsAliases: false,
    timezone: '+5:30'
});

var enduserFields = endUser.fields();
var enduserModel = Model.init(enduserFields, { sequelize, modelName: 'Enduser', tableName: 'aqu_enduser' })

enduserModel.findAll()
    .then((data) => {
        console.log("enduserdata", data)
    })
    .catch((error) => {
        console.log("error", error)
    });


//const customer = require('./customer').default;
var customerFields = customer.fields();
var customerModel = Model.init(customerFields, { sequelize, modelName: 'Customer', tableName: 'aqu_customer' });
//customerModel.associate()

customerModel.findAll()
    .then((data) => {
        console.log("customerdata", data)
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