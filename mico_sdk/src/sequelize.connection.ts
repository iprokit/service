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
        this.options.host = this.options.host !== undefined ? this.options.host: DockerUtility.getHostIP();
        this.options.timezone = this.options.timezone !== undefined ? this.options.timezone: '+00:00';

        this.sequelize = new Sequelize(this.options.name, this.options.username, this.options.password, {
            host: this.options.host,
            dialect: this.options.dialect,
            timezone: this.options.timezone
        });

        //Securing sensitive information.
        this.options.username = 'xxxxxxxxxx';
        this.options.password = 'xxxxxxxxxx';
    }

    connect(){
        this.sequelize.authenticate()
            .then(() => {
                console.log('Connected to %s://%s/%s', this.options.dialect, this.options.host, this.options.name);
            })
            .catch((error: any) => {
                console.error('Unable to connect to the database:', error);
            });

        //TODO: Have to remove this from here once the synchronization() is moved to service
        if(this.options.force !== undefined){
            this.synchronization(this.options.force);
        }
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

    //TODO: Should be exposed to service
    synchronization(force: boolean) {
        this.sequelize.sync({force})
            .then(() => {
                console.log('Database & tables created on %s://%s/%s', this.options.dialect, this.options.host, this.options.name);
            })
            .catch((error: any) => {
                console.log('Table creation failed:', error);
            });
    }
}