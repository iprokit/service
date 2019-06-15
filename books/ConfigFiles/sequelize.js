import Sequelize from 'sequelize'
//Sequelize Class
class CustomSequelize {
    //Constructor
    constructor(Authenticate, SynchForce, DB_NAME, DB_USERNAME, DB_PASSWORD, DB_HOST, DB_DIALECT, DB_MAX_POOL, DB_MIN_POOL, DB_ACQUIRE_POOL, DB_IDLE_POOL) {
        this.SynchForce = SynchForce
        this.Authenticate = Authenticate
        this.DB_NAME = DB_NAME
        this.DB_USERNAME = DB_USERNAME
        this.DB_PASSWORD = DB_PASSWORD
        this.DB_HOST = DB_HOST
        this.DB_DIALECT = DB_DIALECT
        this.DB_MAX_POOL = DB_MAX_POOL
        this.DB_MIN_POOL = DB_MIN_POOL
        this.DB_ACQUIRE_POOL = DB_ACQUIRE_POOL
        this.DB_IDLE_POOL = DB_IDLE_POOL
    }
    //Init
    init() {
        if (this.Authenticate) {
            this.authentication()
        } else {
            this.synchronization()
        }
    }
    //This method is used for sequelize connection setup
    static sequelize() {
        return new Sequelize(this.DB_NAME, this.DB_USERNAME, this.DB_PASSWORD, {
            host: this.DB_HOST,
            dialect: this.DB_DIALECT || 'mysql',
            operatorsAliases: false,
            pool: {
                max: this.DB_MAX_POOL || 3,
                min: this.DB_MIN_POOL || 2,
                acquire: this.DB_ACQUIRE_POOL || 30000,
                idle: this.DB_IDLE_POOL || 10000
            }
        })
    }
    //Test the connection by trying to authenticate Aliases: validate
    authentication() {
        CustomSequelize.sequelize()
            .authenticate()
            .then(() => {
                console.log('Connection has been established successfully.');
            })
            .catch(err => {
                console.error('Unable to connect to the database:', err.message);
            })
    }
    //Sync all defined models to the DB.
    synchronization() {
        CustomSequelize.sequelize().sync({ force: this.SynchForce })
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