//Import modules
import {Sequelize} from 'sequelize';

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
        this.options.timezone = typeof this.options.timezone !== 'undefined' ? this.options.timezone: '+00:00';
        this.options.operatorsAliases = typeof this.options.operatorsAliases !== 'undefined' ? this.options.operatorsAliases: false;

        this.sequelize = new Sequelize(this.options.name, this.options.username, this.options.password, {
            host: this.options.host,
            dialect: this.options.dialect,
            operatorsAliases: this.options.operatorsAliases,
            timezone: this.options.timezone
        });

        //Securing sensitive information.
        this.options.username = 'xxxxxxxxxx';
        this.options.password = 'xxxxxxxxxx';
    }

    connect(): Sequelize {
        this.sequelize.authenticate()
            .then(() => {
                console.log('Connected to %s://%s/%s', this.options.dialect, this.options.host, this.options.name);
            })
            .catch((error: any) => {
                console.error('Unable to connect to the database:', error);
            });

        if(this.options.force !== undefined){//TODO: Have to remove this from here once the synchronization() is moved to service
            this.synchronization(this.options.force);
        }

        return this.sequelize;
    }

    disconnect(){
        this.sequelize.close()
        .then(() => {
            console.log('Disconnected from database.');
        })
        .catch((error: any) => {
            console.error('Unable to disconnect from the database:', error);
        });
    }

    synchronization(force: boolean) { //TODO: Should be exposed to service
        this.sequelize.sync({force})
            .then(() => {
                console.log('Database & tables created on %s://%s/%s', this.options.dialect, this.options.host, this.options.name);
            })
            .catch((error: any) => {
                console.log('Table creation failed:', error);
            });
    }
}