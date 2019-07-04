//Import modules
import {Sequelize} from 'sequelize';

//Local Imports
import DockerUtility from './docker.utility';

var host: any;
var name: string;
var dialect: any;
var auth: boolean;
var force: boolean;
var operatorsAliases: any = false;

export default class SequelizeConnection {
    docker: DockerUtility;
    sequelize: Sequelize

    //Default Constructor
    constructor(dbConfig: any) {
        this.docker = new DockerUtility();
        dialect = dbConfig.dialect;
        name = dbConfig.name;

        if (!dbConfig.hasOwnProperty('host') || dbConfig.host === '') {
            host = this.docker.getHostIP();
        } else {
            host = dbConfig.host;
        }

        if (!dbConfig.hasOwnProperty('auth') || dbConfig.auth === '') {
            auth = true;
        } else {
            auth = dbConfig.auth;
        }

        if (!dbConfig.hasOwnProperty('force') || dbConfig.force === '') {
            force = false;
        } else {
            force = dbConfig.force;
        }
        this.sequelize = new Sequelize(name, dbConfig.username, dbConfig.password, {
            host: host,
            dialect: dialect,
            operatorsAliases: operatorsAliases,
            timezone: dbConfig.timezone
        });
    }

    start() {
        if (auth) {
            this.authentication();
        } else {
            this.synchronization(force);
        }
    }

    authentication() {
        this.sequelize.authenticate()
            .then(() => {
                console.log('Connected to %s://%s/%s', dialect, host, name);
            })
            .catch((error: any) => {
                console.error('Unable to connect to the database:', error);
            });
    }

    synchronization(force: boolean) { //Should be exposed to service
        this.sequelize.sync({force})
            .then(() => {
                console.log('Database & tables created on %s://%s/%s', dialect, host, name);
            })
            .catch((error: any) => {
                console.log('Table creation failed:', error);
            });
    }

    getConnection(){
        return this.sequelize;
    }
}