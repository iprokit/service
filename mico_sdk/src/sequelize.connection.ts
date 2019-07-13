//Import modules
import {Sequelize} from 'sequelize';

//Local Imports
import DockerUtility from './docker.utility';

export default class SequelizeConnection {
    options: any;
    sequelize: Sequelize;

    //Default Constructor
    public constructor(options: any) {
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

    public connect(){
        this.sequelize.authenticate()
            .then(() => {
                console.log('Connected to %s://%s/%s', this.options.dialect, this.options.host, this.options.name);
            })
            .catch((error: any) => {
                console.error('Unable to connect to the database:', error);
            });
    }

    public disconnect(){
        this.sequelize.close()
            .then(() => {
                console.log('Disconnected from %s://%s/%s', this.options.dialect, this.options.host, this.options.name);
            })
            .catch((error: any) => {
                console.error('Unable to disconnect the database:', error);
            });
    }

    public sync(force: boolean) {
        const sequelize = this.sequelize;
        return new Promise(function(resolve, reject){
            sequelize.sync({force})
            .then(() => {
                resolve();
            })
            .catch((error: any) => {
                reject(error);
            });
        })
    }
}