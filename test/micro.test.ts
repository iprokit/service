//Import Libs.
import mocha from 'mocha';
import assert from 'assert';

//Import Local.
import micro, { mesh, proxy, models, messengers, controllers } from '../lib/micro';
import Default from '../lib/default';

//Import Util.
import { silentLog } from './util';

const logPath = '/Users/iprotechs/Desktop/logs';

/**
 * Since Micro is a singelton each test has to be manually unskipped.
 */
mocha.describe('Micro Test', () => {
    //Need to force set log path for testing.
    process.env.LOG_PATH = logPath;

    mocha.it('should create Micro with default options', () => {
        const service = micro();
        silentLog(service);

        //Options Variables.
        assert.deepStrictEqual(service.name, process.env.npm_package_name);
        assert.deepStrictEqual(service.version, process.env.npm_package_version);
        assert.deepStrictEqual(service.environment, Default.ENVIRONMENT);
        assert.deepStrictEqual(service.httpPort, Default.HTTP_PORT);
        assert.deepStrictEqual(service.scpPort, Default.SCP_PORT);
        assert.deepStrictEqual(service.discoveryPort, Default.DISCOVERY_PORT);
        assert.deepStrictEqual(service.discoveryIp, Default.DISCOVERY_IP);
        assert.deepStrictEqual(service.logPath, logPath);

        //Global Variables.
        assert.strictEqual(mesh, service.scpClientManager.mesh);
        assert.strictEqual(proxy, service.proxyClientManager.proxy);
        assert.deepStrictEqual(models, {});
        assert.deepStrictEqual(messengers, {});
        assert.deepStrictEqual(controllers, {});

        //Namespace Variables.
        assert.deepStrictEqual(micro.connection(), undefined);
        assert.notDeepStrictEqual(micro.logger(), undefined);
    });

    mocha.it.skip('should create Micro with custom(environment) options', () => {
        //Set environment variables.
        process.env.NODE_ENV = 'dev';
        process.env.HTTP_PORT = '3001';
        process.env.SCP_PORT = '6001';
        process.env.DISCOVERY_PORT = '5001';
        process.env.DISCOVERY_IP = '10.0.0.1';

        const service = micro();
        silentLog(service);

        //Options Variables.
        assert.deepStrictEqual(service.name, process.env.npm_package_name);
        assert.deepStrictEqual(service.version, process.env.npm_package_version);
        assert.deepStrictEqual(service.environment, 'dev');
        assert.deepStrictEqual(service.httpPort, 3001);
        assert.deepStrictEqual(service.scpPort, 6001);
        assert.deepStrictEqual(service.discoveryPort, 5001);
        assert.deepStrictEqual(service.discoveryIp, '10.0.0.1');
        assert.deepStrictEqual(service.logPath, logPath);

        //Global Variables.
        assert.strictEqual(mesh, service.scpClientManager.mesh);
        assert.strictEqual(proxy, service.proxyClientManager.proxy);
        assert.deepStrictEqual(models, {});
        assert.deepStrictEqual(messengers, {});
        assert.deepStrictEqual(controllers, {});

        //Namespace Variables.
        assert.deepStrictEqual(micro.connection(), undefined);
        assert.notDeepStrictEqual(micro.logger(), undefined);
    });

    mocha.it.skip('should create Micro with custom(creation) options', () => {
        const service = micro({ name: 'Hero', version: '2.10.1' });
        silentLog(service);

        //Options Variables.
        assert.deepStrictEqual(service.name, 'Hero');
        assert.deepStrictEqual(service.version, '2.10.1');
        assert.deepStrictEqual(service.environment, Default.ENVIRONMENT);
        assert.deepStrictEqual(service.httpPort, Default.HTTP_PORT);
        assert.deepStrictEqual(service.scpPort, Default.SCP_PORT);
        assert.deepStrictEqual(service.discoveryPort, Default.DISCOVERY_PORT);
        assert.deepStrictEqual(service.discoveryIp, Default.DISCOVERY_IP);
        assert.deepStrictEqual(service.logPath, logPath);

        //Global Variables.
        assert.strictEqual(mesh, service.scpClientManager.mesh);
        assert.strictEqual(proxy, service.proxyClientManager.proxy);
        assert.deepStrictEqual(models, {});
        assert.deepStrictEqual(messengers, {});
        assert.deepStrictEqual(controllers, {});

        //Namespace Variables.
        assert.deepStrictEqual(micro.connection(), undefined);
        assert.notDeepStrictEqual(micro.logger(), undefined);
    });

    mocha.it.skip('should create Micro with custom(db: creation + environment) options and valid connection', () => {
        //Set db environment variables.
        process.env.DB_HOST = '10.0.0.2';
        process.env.DB_NAME = 'HeroDB';
        process.env.DB_USERNAME = 'HeroUser';
        process.env.DB_PASSWORD = 'HeroPass';

        const service = micro({ db: { type: 'mysql', paperTrail: false } });
        silentLog(service);

        //Options Variables.
        assert.deepStrictEqual(service.name, process.env.npm_package_name);
        assert.deepStrictEqual(service.version, process.env.npm_package_version);
        assert.deepStrictEqual(service.environment, Default.ENVIRONMENT);
        assert.deepStrictEqual(service.httpPort, Default.HTTP_PORT);
        assert.deepStrictEqual(service.scpPort, Default.SCP_PORT);
        assert.deepStrictEqual(service.discoveryPort, Default.DISCOVERY_PORT);
        assert.deepStrictEqual(service.discoveryIp, Default.DISCOVERY_IP);
        assert.deepStrictEqual(service.logPath, logPath);

        //Global Variables.
        assert.strictEqual(mesh, service.scpClientManager.mesh);
        assert.strictEqual(proxy, service.proxyClientManager.proxy);
        assert.deepStrictEqual(models, {});
        assert.deepStrictEqual(messengers, {});
        assert.deepStrictEqual(controllers, {});

        //Namespace Variables.
        assert.deepStrictEqual(micro.connection(), service.dbManager.connection);
        assert.notDeepStrictEqual(micro.logger(), undefined);

        //DB Variables.
        assert.deepStrictEqual(service.dbManager.type, 'mysql');
        assert.deepStrictEqual(service.dbManager.host, '10.0.0.2');
        assert.deepStrictEqual(service.dbManager.name, 'HeroDB');
        assert.deepStrictEqual(service.dbManager.username, 'HeroUser');
        assert.deepStrictEqual(service.dbManager.password, 'HeroPass');
        assert.deepStrictEqual(service.dbManager.paperTrail, false);
    });

    mocha.it.skip('should create Micro with custom(db: creation) options and invalid connection', () => {
        const service = micro({ db: { type: 'mysql', paperTrail: false } });
        silentLog(service);

        //Options Variables.
        assert.deepStrictEqual(service.name, process.env.npm_package_name);
        assert.deepStrictEqual(service.version, process.env.npm_package_version);
        assert.deepStrictEqual(service.environment, Default.ENVIRONMENT);
        assert.deepStrictEqual(service.httpPort, Default.HTTP_PORT);
        assert.deepStrictEqual(service.scpPort, Default.SCP_PORT);
        assert.deepStrictEqual(service.discoveryPort, Default.DISCOVERY_PORT);
        assert.deepStrictEqual(service.discoveryIp, Default.DISCOVERY_IP);
        assert.deepStrictEqual(service.logPath, logPath);

        //Global Variables.
        assert.strictEqual(mesh, service.scpClientManager.mesh);
        assert.strictEqual(proxy, service.proxyClientManager.proxy);
        assert.deepStrictEqual(models, {});
        assert.deepStrictEqual(messengers, {});
        assert.deepStrictEqual(controllers, {});

        //Namespace Variables.
        assert.deepStrictEqual(micro.connection(), service.dbManager.connection);
        assert.notDeepStrictEqual(micro.logger(), undefined);

        //DB Variables.
        assert.deepStrictEqual(service.dbManager.type, 'mysql');
        assert.deepStrictEqual(service.dbManager.host, undefined);
        assert.deepStrictEqual(service.dbManager.name, undefined);
        assert.deepStrictEqual(service.dbManager.username, undefined);
        assert.deepStrictEqual(service.dbManager.password, undefined);
        assert.deepStrictEqual(service.dbManager.paperTrail, false);
    });
});