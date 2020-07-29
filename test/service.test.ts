//Import @iprotechs Modules
import { Mesh } from '@iprotechs/scp';

//Import Libs.
import mocha from 'mocha';
import assert from 'assert';

//Import Local.
import Default from '../lib/default';
import Service, { Options } from '../lib/service';
import { Proxy } from '../lib/proxy.client.manager';

const logPath = '/Users/iprotechs/Desktop/logs';

mocha.describe('Service Test', () => {
    mocha.describe('Constructor Test', () => {
        mocha.it('should construct Service with default variables.', () => {
            const options: Options = {
                name: 'HeroSVC',
                version: '1.0.0',
                logPath: logPath,
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

        mocha.it('should construct Service with custom variables.', () => {
            const mesh = new Mesh();
            const proxy = new Proxy();

            const options: Options = {
                name: 'HeroSVC',
                version: '1.0.0',
                environment: 'dev',
                httpPort: 1000,
                scpPort: 2000,
                discoveryPort: 3000,
                discoveryIp: '224.0.0.2',
                forceStopTime: 1000,
                logPath: logPath,
                mesh: mesh,
                proxy: proxy
            }

            const service = new Service(options);

            //Options Variables.
            assert.deepEqual(service.name, 'HeroSVC');
            assert.deepEqual(service.version, '1.0.0');
            assert.deepEqual(service.environment, 'dev');
            assert.deepEqual(service.httpPort, 1000);
            assert.deepEqual(service.scpPort, 2000);
            assert.deepEqual(service.discoveryPort, 3000);
            assert.deepEqual(service.discoveryIp, '224.0.0.2');
            assert.deepEqual(service.forceStopTime, 1000);
            assert.deepEqual(service.logPath, logPath);
            assert.deepEqual(service.scpClientManager.mesh, mesh);
            assert.deepEqual(service.proxyClientManager.proxy, proxy);

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

    mocha.describe('#start() & starting/ready Event Test', () => {
        const service = new Service({ name: 'HeroSVC', version: '1.0.0', logPath: logPath, });
        silentLog(service);

        mocha.after((done) => {
            service.stop((exitCode) => {
                assert.deepEqual(exitCode, 0);

                done();
            });
        });

        mocha.it('should emit starting/ready event', (done) => {
            let starting = false;

            service.on('starting', () => {
                starting = true;
            });
            service.on('ready', () => {
                assert.deepEqual(starting, true);
                done();
            });
            service.start(() => {
                assert.deepEqual(service.scpServer.listening, true);
                assert.deepEqual(service.scpClientManager.connected, {});
                assert.deepEqual(service.proxyClientManager.linked, {});
                assert.deepEqual(service.discovery.listening, true);
                assert.deepEqual(service.serviceRegistry.connected, undefined);
                assert.deepEqual(service.httpServer.listening, true);
            });
        });
    });

    mocha.describe('#stop() & stopping/stopped Event Test', () => {
        const service = new Service({ name: 'HeroSVC', version: '1.0.0', logPath: logPath, });
        silentLog(service);

        mocha.before((done) => {
            service.start(done);
        });

        mocha.it('should emit stopping/stopped event', (done) => {
            let stopping = false;

            service.on('stopping', () => {
                stopping = true;
            });
            service.on('stopped', () => {
                assert.deepEqual(stopping, true);
                done();
            });
            service.stop((exitCode) => {
                assert.deepEqual(exitCode, 0);

                assert.deepEqual(service.scpServer.listening, false);
                assert.deepEqual(service.scpClientManager.connected, {});
                assert.deepEqual(service.proxyClientManager.linked, {});
                assert.deepEqual(service.discovery.listening, false);
                assert.deepEqual(service.serviceRegistry.connected, undefined);
                assert.deepEqual(service.httpServer.listening, false);
            });
        });
    });

    mocha.describe('Default Routes Test', () => {
        //TODO: Work from here.

        //Cors test.
        //JSON test.
        //404 test.
        //Service Unavailable Test.
    });

    mocha.describe('Service Routes Test', () => {
        //health test.
        //report test.
        //shutdown test.
    });

    mocha.describe('Proxy Test', () => {

    });

    mocha.describe('Create Route Test', () => {

    });

    mocha.describe('Service Registry Test', () => {
        //available event test
        //unavailable event test
    });
});

//////////////////////////////
//////Helpers
//////////////////////////////
function silentLog(service: Service) {
    service.logger.transports.forEach((transport) => (transport.silent = true));
}