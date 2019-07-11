import { Sequelize, DataTypes } from 'sequelize';
import Customer from './customer';
import EndUser from './enduser';

const sequelize = new Sequelize('CUSTOMER_DB', 'varaaqu', 'ipro2019', {
    host: 'ec2-13-234-76-76.ap-south-1.compute.amazonaws.com',
    dialect: 'mysql',
    timezone: '+5:30'
});

Customer.init(Customer.fields(), {sequelize, tableName: 'aqu_customer', modelName: 'Customer'});
EndUser.init(EndUser.fields(), {sequelize, tableName: 'aqu_enduser', modelName: 'EndUser'})

Customer.associate();
EndUser.associate();
    
sequelize.authenticate()
    .then(() => {
        console.log('Connected to DB');
    })
    .catch((error) => {
        console.error('Unable to connect to the database:', error);
    });

Customer.findAll()
    .then((data) => {
        console.log("customerdata", data)
    })
    .catch((error) => {
        console.log("error", error)
    });

EndUser.findAll()
    .then((data) => {
        console.log("enduserdata", data)
    })
    .catch((error) => {
        console.log("error", error)
    });