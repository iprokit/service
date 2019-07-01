//Import modules
import {Sequelize} from 'sequelize';
//Local Imports
import DockerUtility from './docker.utility';

//Init variables
// var docker = new DockerUtility();

class SequelizeConnection {
    docker: any;
    dialect: any;
    name: string;
    host: any;
    auth: boolean;
    force: boolean;
    sequelize: any;
    operatorsAliases: any = false;

    //Default Constructor
    constructor(dbConfig: any) {
        this.docker = new DockerUtility();

        this.dialect = dbConfig.dialect;
        this.name = dbConfig.name;

        if (!dbConfig.hasOwnProperty('host') || dbConfig.host === '') {
            this.host = this.docker.getHostIP();
        } else {
            this.host = dbConfig.host;
        }

        if (!dbConfig.hasOwnProperty('auth') || dbConfig.auth === '') {
            this.auth = true;
        } else {
            this.auth = dbConfig.auth;
        }

        if (!dbConfig.hasOwnProperty('force') || dbConfig.force === '') {
            this.force = false;
        } else {
            this.force = dbConfig.force;
        }
        this.sequelize = new Sequelize(this.name, dbConfig.username, dbConfig.password, {
            host: this.host,
            dialect: this.dialect,
            operatorsAliases: this.operatorsAliases,
            timezone: dbConfig.timezone
        });

    }

    start() {
        if (this.auth) {
            this.authentication();
        } else {
            this.synchronization(this.force);
        }
    }

    authentication() {
        this.sequelize.authenticate()
            .then(() => {
                console.log('Connected to %s://%s/%s', this.dialect, this.host, this.name);
            })
            .catch((error: any) => {
                console.error('Unable to connect to the database:', error);
            });
    }

    synchronization(force: boolean) { //Should be exposed to service
        this.sequelize.sync({force})
            .then(() => {
                console.log('Database & tables created on %s://%s/%s', this.dialect, this.host, this.name);
            })
            .catch((error: any) => {
                console.log('Table creation failed:', error);
            });
    }

    getSequelize() {
        return this.sequelize;
    }
}

export default SequelizeConnection;
