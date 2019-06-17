import Sequelize from 'sequelize'

var sequelize;

//Sequelize Class
class Sequelize {
    //Constructor
    constructor(DB_NAME, DB_USERNAME, DB_PASSWORD, DB_HOST, DB_DIALECT, isAuth, isSync) {
        this.isAuth = isAuth;
        this.isSync = isSync;

        sequelize = new Sequelize(DB_NAME, DB_USERNAME, DB_NAME, DB_DIALECT);
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
export default Sequelize