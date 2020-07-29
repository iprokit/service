//Import Libs.
import path from 'path';
import mocha from 'mocha';
import assert from 'assert';

//Import Local.
import Default from '../lib/default';
import Service, { Options } from '../lib/service';

mocha.describe('Service Test', () => {
    mocha.describe('Constructor Test', () => {
        mocha.it('should construct Service with default variables and no DB.', () => {
            const logPath = path.join(path.dirname(require.main.filename), '/logs');

            const options: Options = {
                name: 'HeroSVC',
                version: '1.0.0',
                logPath: logPath
            }

            const service = new Service(options);

            //Options Variables.
            assert.deepEqual(service.name, 'HeroSVC');
            assert.deepEqual(service.version, '1.0.0');
            assert.deepEqual(service.environment, Default.ENVIRONMENT);
            assert.deepEqual(service.httpPort, Default.HTTP_PORT);
            assert.deepEqual(service.scpPort, Default.SCP_PORT);
            assert.deepEqual(service.discoveryPort, Default.DISCOVERY_PORT);
            assert.deepEqual(service.discoveryIp, Default.DISCOVERY_IP);
            assert.deepEqual(service.forceStopTime, Default.FORCE_STOP_TIME);
            assert.deepEqual(service.logPath, logPath);
            assert.notDeepEqual(service.scpClientManager.mesh, undefined);
            assert.notDeepEqual(service.proxyClientManager.proxy, undefined);

            //Class Variables.
            assert.notDeepEqual(service.ip, undefined);
            assert.notDeepEqual(service.hooks, undefined);
            assert.notDeepEqual(service.logger, undefined);
            assert.deepEqual(service.dbManager, undefined);
            assert.notDeepEqual(service.scpServer, undefined);
            assert.notDeepEqual(service.scpClientManager, undefined);
            assert.notDeepEqual(service.proxyClientManager, undefined);
            assert.notDeepEqual(service.discovery, undefined);
            assert.notDeepEqual(service.serviceRegistry, undefined);
            assert.notDeepEqual(service.express, undefined);
            assert.notDeepEqual(service.routes, undefined);
        });
    });
});