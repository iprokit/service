//Import modules
import {Sequelize, Dialect} from 'sequelize';

//Local Imports
import DockerUtility from './docker.utility';

export default class SequelizeConnection {
    options: any;
    sequelize: Sequelize;

    //Default Constructor
    constructor(options: any) {
        this.options = options;

        //Init variables.
        this.options.host = typeof this.options.host !== 'undefined' ? this.options.host: DockerUtility.getHostIP();
        this.options.auth = typeof this.options.auth !== 'undefined' ? this.options.auth: true;
        this.options.force = typeof this.options.force !== 'undefined' ? this.options.force: false;
        this.options.operatorsAliases = typeof this.options.operatorsAliases !== 'undefined' ? this.options.operatorsAliases: false;
        this.options.timezone = typeof this.options.timezone !== 'undefined' ? this.options.timezone: '+00:00';

        this.sequelize = new Sequelize(this.options.name, this.options.username, this.options.password, {
            host: this.options.host,
            dialect: this.options.dialect,
            operatorsAliases: this.options.operatorsAliases,
            timezone: this.options.timezone
        });
    }

    start() {
        if (this.options.auth) {
            this.authentication();
        } else {
            this.synchronization(this.options.force);
        }
    }

    authentication() {
        this.sequelize.authenticate()
            .then(() => {
                console.log('Connected to %s://%s/%s', this.options.dialect, this.options.host, this.options.name);
            })
            .catch((error: any) => {
                console.error('Unable to connect to the database:', error);
            });
    }

    synchronization(force: boolean) { //Should be exposed to service
        this.sequelize.sync({force})
            .then(() => {
                console.log('Database & tables created on %s://%s/%s', this.options.dialect, this.options.host, this.options.name);
            })
            .catch((error: any) => {
                console.log('Table creation failed:', error);
            });
    }

    getConnection(){
        return this.sequelize;
    }
}