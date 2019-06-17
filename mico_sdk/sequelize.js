import Sequelize from 'sequelize'

var sequelize;

//Sequelize Class
class CustomSequelize {
    //Constructor
    constructor(DB_NAME, DB_USERNAME, DB_PASSWORD, DB_HOST, DB_DIALECT, isAuth, isSync) {
        this.isAuth = isAuth;
        this.isSync = isSync;
        //Connection Setup
        sequelize = new Sequelize(DB_NAME, DB_USERNAME, DB_PASSWORD, {
            host: DB_HOST,
            dialect: DB_DIALECT,
            operatorsAliases: false,
            timezone: "+5:30",
            logging: true,
        })
    }
    //Init
    init() {
        if (this.isAuth) {
            this.authentication()
        } else {
            this.synchronization()
        }
    }

    //Test the connection by trying to authenticate Aliases: validate
    authentication() {
        sequelize.authenticate()
            .then(() => {
                console.log('Connection has been established successfully.');
            })
            .catch(err => {
                console.error('Unable to connect to the database:', err.message);
            })
    }
    //Sync all defined models to the DB.
    synchronization() {
        sequelize.sync({ force: this.isSync })
            .then(() => {
                console.log(`Database & tables created!`)
            })
            .catch(error => {
                console.log("Table Creation Failed & Error is", error.message)
            })
    }
}
//Export sequelize connection                        
export default CustomSequelize