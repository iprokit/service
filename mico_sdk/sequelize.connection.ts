//Import modules
import {Sequelize} from 'sequelize';

//Local Imports
import DockerUtility from './docker.utility';

export default class SequelizeConnection {
    host: any;
    name: string;
    dialect: any;
    auth: boolean;
    force: boolean;
    operatorsAliases: any = false;
    docker: DockerUtility;
    sequelize: Sequelize

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

    getConnection(){
        return this.sequelize;
    }
}