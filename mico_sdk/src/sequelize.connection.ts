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
        return this.sequelize.authenticate();
    }

    disconnect(){
        return this.sequelize.close();
    }

    sync(force: boolean) {
        return this.sequelize.sync({force});
    }
}