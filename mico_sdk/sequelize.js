import Sequelize from 'sequelize'
//Sequelize Class
class CustomSequelize {
    //Constructor
    constructor(DB_NAME, DB_USERNAME, DB_PASSWORD, DB_HOST, DB_DIALECT, isAuth, isSync) {
        this.DB_NAME = DB_NAME
        this.DB_USERNAME = DB_USERNAME
        this.DB_PASSWORD = DB_PASSWORD
        this.DB_HOST = DB_HOST
        this.DB_DIALECT = DB_DIALECT
        this.isAuth = isAuth
        this.isSync = isSync
    }
    //Init
    init() {
        if (this.isAuth) {
            this.authentication()
        } else {
            this.synchronization()
        }
    }
    //Connection Setup
    static sequelize(){
        return new Sequelize(DB_NAME, DB_USERNAME, DB_PASSWORD, {
            host: DB_HOST,
            dialect: DB_DIALECT || 'mysql',
            operatorsAliases: false,
            timezone: "+5:30",
            logging: true, 
        })
    }
    //Test the connection by trying to authenticate Aliases: validate
    authentication() {
        CustomSequelize.sequelize().authenticate()
            .then(() => {
                console.log('Connection has been established successfully.');
            })
            .catch(err => {
                console.error('Unable to connect to the database:', err.message);
            })
    }
    //Sync all defined models to the DB.
    synchronization() {
        CustomSequelize.sequelize().sync({ force: this.isSync })
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