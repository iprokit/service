//Import @iprotechs Modules
import { Mesh, Body } from '@iprotechs/scp';

//Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { RequestHandler } from 'express';

//Import Local.
import Default from '../lib/default';
import Service, { Options, InvalidServiceOptions, RemoteService } from '../lib/service';
import { Proxy } from '../lib/proxy.client.manager';
import HttpStatusCodes from '../lib/http.statusCodes';

//Import Util.
import { silentLog, httpRequest } from './util';

const logPath = '/Users/iprotechs/Desktop/logs';

mocha.describe('Service Test', () => {
    mocha.describe('Constructor Test', () => {
        mocha.it('should construct Service with default variables.', () => {
            const options: Options = {
                name: 'HeroSVC',
                logPath: logPath
            }

            const service = new Service(options);

            //Options Variables.
            assert.deepStrictEqual(service.name, 'HeroSVC');
            assert.deepStrictEqual(service.version, Default.VERSION);
            assert.deepStrictEqual(service.environment, Default.ENVIRONMENT);
            assert.deepStrictEqual(service.httpPort, Default.HTTP_PORT);
            assert.deepStrictEqual(service.scpPort, Default.SCP_PORT);
            assert.deepStrictEqual(service.discoveryPort, Default.DISCOVERY_PORT);
            assert.deepStrictEqual(service.discoveryIp, Default.DISCOVERY_IP);
            assert.deepStrictEqual(service.logPath, logPath);
            assert.notDeepStrictEqual(service.scpClientManager.mesh, undefined);
            assert.notDeepStrictEqual(service.proxyClientManager.proxy, undefined);

            //Class Variables.
            assert.notDeepStrictEqual(service.ip, undefined);
            assert.notDeepStrictEqual(service.hooks, undefined);
            assert.notDeepStrictEqual(service.logger, undefined);
            assert.deepStrictEqual(service.dbManager, undefined);
            assert.notDeepStrictEqual(service.scpServer, undefined);
            assert.notDeepStrictEqual(service.scpClientManager, undefined);
            assert.notDeepStrictEqual(service.proxyClientManager, undefined);
            assert.notDeepStrictEqual(service.discovery, undefined);
            assert.notDeepStrictEqual(service.serviceRegistry, undefined);
            assert.notDeepStrictEqual(service.express, undefined);
            assert.notDeepStrictEqual(service.routers, undefined);
        });

        mocha.it('should construct Service with custom(Truthy) variables.', () => {
            const mesh = new Mesh();
            const proxy = new Proxy();

            const options: Options = {
                name: 'HeroSVC',
                version: '2.10.1',
                environment: 'development',
                httpPort: 3001,
                scpPort: 6001,
                discoveryPort: 5001,
                discoveryIp: '224.0.0.2',
                logPath: logPath,
                mesh: mesh,
                proxy: proxy
            }

            const service = new Service(options);

            //Options Variables.
            assert.deepStrictEqual(service.name, 'HeroSVC');
            assert.deepStrictEqual(service.version, '2.10.1');
            assert.deepStrictEqual(service.environment, 'development');
            assert.deepStrictEqual(service.httpPort, 3001);
            assert.deepStrictEqual(service.scpPort, 6001);
            assert.deepStrictEqual(service.discoveryPort, 5001);
            assert.deepStrictEqual(service.discoveryIp, '224.0.0.2');
            assert.deepStrictEqual(service.logPath, logPath);
            assert.deepStrictEqual(service.scpClientManager.mesh, mesh);
            assert.deepStrictEqual(service.proxyClientManager.proxy, proxy);

            //Class Variables.
            assert.notDeepStrictEqual(service.ip, undefined);
            assert.notDeepStrictEqual(service.hooks, undefined);
            assert.notDeepStrictEqual(service.logger, undefined);
            assert.deepStrictEqual(service.dbManager, undefined);
            assert.notDeepStrictEqual(service.scpServer, undefined);
            assert.notDeepStrictEqual(service.scpClientManager, undefined);
            assert.notDeepStrictEqual(service.proxyClientManager, undefined);
            assert.notDeepStrictEqual(service.discovery, undefined);
            assert.notDeepStrictEqual(service.serviceRegistry, undefined);
            assert.notDeepStrictEqual(service.express, undefined);
            assert.notDeepStrictEqual(service.routers, undefined);
        });

        mocha.it('should construct Service with custom(Falsy) variables.', () => {
            const mesh = new Mesh();
            const proxy = new Proxy();

            const options: Options = {
                name: '',
                version: '',
                environment: '',
                httpPort: 0,
                scpPort: 0,
                discoveryPort: 0,
                discoveryIp: '',
                logPath: logPath,
                mesh: mesh,
                proxy: proxy
            }

            const service = new Service(options);

            //Options Variables.
            assert.deepStrictEqual(service.name, '');
            assert.deepStrictEqual(service.version, '');
            assert.deepStrictEqual(service.environment, '');
            assert.deepStrictEqual(service.httpPort, 0);
            assert.deepStrictEqual(service.scpPort, 0);
            assert.deepStrictEqual(service.discoveryPort, 0);
            assert.deepStrictEqual(service.discoveryIp, '');
            assert.deepStrictEqual(service.logPath, logPath);
            assert.deepStrictEqual(service.scpClientManager.mesh, mesh);
            assert.deepStrictEqual(service.proxyClientManager.proxy, proxy);

            //Class Variables.
            assert.notDeepStrictEqual(service.ip, undefined);
            assert.notDeepStrictEqual(service.hooks, undefined);
            assert.notDeepStrictEqual(service.logger, undefined);
            assert.deepStrictEqual(service.dbManager, undefined);
            assert.notDeepStrictEqual(service.scpServer, undefined);
            assert.notDeepStrictEqual(service.scpClientManager, undefined);
            assert.notDeepStrictEqual(service.proxyClientManager, undefined);
            assert.notDeepStrictEqual(service.discovery, undefined);
            assert.notDeepStrictEqual(service.serviceRegistry, undefined);
            assert.notDeepStrictEqual(service.express, undefined);
            assert.notDeepStrictEqual(service.routers, undefined);
        });

        mocha.it('should not construct Service with custom(Invalid) variables.', () => {
            let service: Service;

            try {
                service = new Service({ name: 'HeroSVC', logPath: '' });
            } catch (error) {
                if (error instanceof InvalidServiceOptions) {
                    assert.deepStrictEqual(error.message, 'Invalid logPath provided.');
                }
            }

            //Options Variables.
            assert.deepStrictEqual(service, undefined);
        });
    });

    mocha.describe('#start() & starting/started Event Test', () => {
        const service = new Service({ name: 'HeroSVC', logPath: logPath });
        silentLog(service);

        mocha.after((done) => {
            service.stop(done);
        });

        mocha.it('should emit starting/started event', (done) => {
            let starting = false;

            service.on('starting', () => {
                starting = true;
            });
            service.on('started', () => {
                assert.deepStrictEqual(starting, true);
                done();
            });

            service.start((error) => {
                assert.deepStrictEqual(error, undefined);
                assert.deepStrictEqual(service.scpServer.listening, true);
                assert.deepStrictEqual(service.scpClientManager.connected, {});
                assert.deepStrictEqual(service.proxyClientManager.linked, {});
                assert.deepStrictEqual(service.discovery.listening, true);
                assert.deepStrictEqual(service.serviceRegistry.connected, undefined);
                assert.deepStrictEqual(service.httpServer.listening, true);
            });
        });
    });

    mocha.describe('#stop() & stopping/stopped Event Test', () => {
        const service = new Service({ name: 'HeroSVC', logPath: logPath });
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
                assert.deepStrictEqual(stopping, true);
                done();
            });

            service.stop((error) => {
                assert.deepStrictEqual(error, undefined);
                assert.deepStrictEqual(service.scpServer.listening, false);
                assert.deepStrictEqual(service.scpClientManager.connected, {});
                assert.deepStrictEqual(service.proxyClientManager.linked, {});
                assert.deepStrictEqual(service.discovery.listening, false);
                assert.deepStrictEqual(service.serviceRegistry.connected, undefined);
                assert.deepStrictEqual(service.httpServer.listening, false);
            });
        });
    });

    mocha.describe('Express Test', () => {
        const service = new Service({ name: 'HeroSVC', logPath: logPath });
        silentLog(service);

        mocha.before((done) => {
            service.start(done);
        });

        mocha.after((done) => {
            service.stop(done);
        });

        mocha.describe('Router(Default) Creation Test', () => {
            //Before Routes.
            service.use('/sidekick', (request, response, next) => {
                request.body.sidekick = true;
                next();
            });

            //Routes.
            service.get('/sidekick', (request, response) => {
                assert.deepStrictEqual(request.body.sidekick, true);

                response.status(HttpStatusCodes.OK).send({ sidekicks: ['War Machine', 'Bucky Barnes', 'Falcon'] });
            }).post('/sidekick', (request, response) => {
                assert.deepStrictEqual(request.body.sidekick, true);

                response.status(HttpStatusCodes.CREATED).send({ sidekick: 'Groot' });
            }).put('/sidekick', (request, response) => {
                assert.deepStrictEqual(request.body.sidekick, true);

                response.status(HttpStatusCodes.OK).send({ sidekick: 'Rick Jones' });
            }).delete('/sidekick', (request, response) => {
                assert.deepStrictEqual(request.body.sidekick, true);

                response.status(HttpStatusCodes.OK).send({ sidekick: 'Old Lace' });
            }).all('/sidekick/alias', (request, response) => {
                assert.deepStrictEqual(request.body.sidekick, true);

                response.status(HttpStatusCodes.OK).send({ alias: 'Rhodey' });
            });

            //After Routes.
            service.use('/sidekick', (request, response) => {
                assert.deepStrictEqual(request.body.sidekick, true);

                response.status(HttpStatusCodes.NOT_FOUND).send({ message: 'No Sidekick Route Found' });
            });

            //Client
            mocha.it('should execute GET(/sidekick) and receive body(JSON) with CORS support', (done) => {
                httpRequest('127.0.0.1', 3000, 'GET', '/sidekick', {}, true, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body, { sidekicks: ['War Machine', 'Bucky Barnes', 'Falcon'] });
                    done(error);
                });
            });

            mocha.it('should execute POST(/sidekick) and receive body(JSON) with CORS support', (done) => {
                httpRequest('127.0.0.1', 3000, 'POST', '/sidekick', {}, true, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.CREATED);
                    assert.deepStrictEqual(response.body, { sidekick: 'Groot' });
                    done(error);
                });
            });

            mocha.it('should execute PUT(/sidekick) and receive body(JSON) with CORS support', (done) => {
                httpRequest('127.0.0.1', 3000, 'PUT', '/sidekick', {}, true, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body, { sidekick: 'Rick Jones' });
                    done(error);
                });
            });

            mocha.it('should execute DELETE(/sidekick) and receive body(JSON) with CORS support', (done) => {
                httpRequest('127.0.0.1', 3000, 'DELETE', '/sidekick', {}, true, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body, { sidekick: 'Old Lace' });
                    done(error);
                });
            });

            mocha.it('should execute ALL:GET(/sidekick/alias) and receive body(JSON) with CORS support', (done) => {
                httpRequest('127.0.0.1', 3000, 'GET', '/sidekick/alias', {}, true, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body, { alias: 'Rhodey' });
                    done(error);
                });
            });

            mocha.it('should execute GET(/sidekick/snap) and receive Error(No Sidekick Route Found) with CORS support', (done) => {
                httpRequest('127.0.0.1', 3000, 'GET', '/sidekick/snap', {}, true, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.NOT_FOUND);
                    assert.deepStrictEqual(response.body, { message: 'No Sidekick Route Found' });
                    done(error);
                });
            });
        });

        mocha.describe('Router(Custom) Creation Test', () => {
            const heroRouter = service.createRouter('/hero');

            //Before Routes.
            heroRouter.use('/', (request, response, next) => {
                request.body.hero = true;
                next();
            });

            //Routes.
            heroRouter.get('/', (request, response) => {
                assert.deepStrictEqual(request.body.hero, true);

                response.status(HttpStatusCodes.OK).send({ heros: ['Captain America', 'Iron Man', 'Black Widow'] });
            }).post('/', (request, response) => {
                assert.deepStrictEqual(request.body.hero, true);

                response.status(HttpStatusCodes.CREATED).send({ hero: 'Vision' });
            }).put('/', (request, response) => {
                assert.deepStrictEqual(request.body.hero, true);

                response.status(HttpStatusCodes.OK).send({ hero: 'Thor' });
            }).delete('/', (request, response) => {
                assert.deepStrictEqual(request.body.hero, true);

                response.status(HttpStatusCodes.OK).send({ hero: 'Doctor Strange' });
            }).all('/alias', (request, response) => {
                assert.deepStrictEqual(request.body.hero, true);

                response.status(HttpStatusCodes.OK).send({ alias: 'Tony Stark' });
            });

            //After Routes.
            heroRouter.use('/', (request, response) => {
                assert.deepStrictEqual(request.body.hero, true);

                response.status(HttpStatusCodes.NOT_FOUND).send({ message: 'No Hero Route Found' });
            });

            //Client
            mocha.it('should execute GET(/hero) and receive body(JSON) with CORS support', (done) => {
                httpRequest('127.0.0.1', 3000, 'GET', '/hero', {}, true, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body, { heros: ['Captain America', 'Iron Man', 'Black Widow'] });
                    done(error);
                });
            });

            mocha.it('should execute POST(/hero) and receive body(JSON) with CORS support', (done) => {
                httpRequest('127.0.0.1', 3000, 'POST', '/hero', {}, true, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.CREATED);
                    assert.deepStrictEqual(response.body, { hero: 'Vision' });
                    done(error);
                });
            });

            mocha.it('should execute PUT(/hero) and receive body(JSON) with CORS support', (done) => {
                httpRequest('127.0.0.1', 3000, 'PUT', '/hero', {}, true, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body, { hero: 'Thor' });
                    done(error);
                });
            });

            mocha.it('should execute DELETE(/hero) and receive body(JSON) with CORS support', (done) => {
                httpRequest('127.0.0.1', 3000, 'DELETE', '/hero', {}, true, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body, { hero: 'Doctor Strange' });
                    done(error);
                });
            });

            mocha.it('should execute ALL:GET(/hero/alias) and receive body(JSON) with CORS support', (done) => {
                httpRequest('127.0.0.1', 3000, 'GET', '/hero/alias', {}, true, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body, { alias: 'Tony Stark' });
                    done(error);
                });
            });

            mocha.it('should execute GET(/hero/snap) and receive Error(No Hero Route Found) with CORS support', (done) => {
                httpRequest('127.0.0.1', 3000, 'GET', '/hero/snap', {}, true, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.NOT_FOUND);
                    assert.deepStrictEqual(response.body, { message: 'No Hero Route Found' });
                    done(error);
                });
            });
        });

        mocha.describe('Default Middleware Test', () => {
            //Routes.
            service.get('/timetravel', (request, response) => {
                response.setTimeout(100);
                setTimeout(() => {
                    try {
                        response.status(HttpStatusCodes.OK).send(request.body);
                    } catch (error) {
                        assert.deepStrictEqual(error.code, 'ERR_HTTP_HEADERS_SENT');
                    }
                }, 200);
            });

            //Client
            mocha.it('should execute GET(/timetravel) and receive Error(Service Unavailable) with CORS support', (done) => {
                httpRequest('127.0.0.1', 3000, 'GET', '/timetravel', {}, true, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.SERVICE_UNAVAILABLE);
                    assert.deepStrictEqual(response.body, { message: 'Service Unavailable' });
                    done(error);
                });
            });

            mocha.it('should execute GET(/snap) and receive Error(Not Found) with CORS support', (done) => {
                httpRequest('127.0.0.1', 3000, 'GET', '/snap', {}, true, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.NOT_FOUND);
                    assert.deepStrictEqual(response.body, { message: 'Not Found' });
                    done(error);
                });
            });
        });

        mocha.describe('Default Routes Test', () => {
            mocha.it('should execute GET(/health) and receive body(JSON)', (done) => {
                httpRequest('127.0.0.1', 3000, 'GET', '/health', {}, true, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body.name, 'HeroSVC');
                    assert.deepStrictEqual(response.body.version, '1.0.0');
                    assert.deepStrictEqual(response.body.httpServer, true);
                    assert.deepStrictEqual(response.body.scpServer, true);
                    assert.deepStrictEqual(response.body.discovery, true);
                    assert.deepStrictEqual(response.body.healthy, true);
                    done(error);
                });
            });

            mocha.it('should execute GET(/report) and receive body(JSON)', (done) => {
                httpRequest('127.0.0.1', 3000, 'GET', '/report', {}, true, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.notDeepStrictEqual(response.body.service, undefined);
                    assert.notDeepStrictEqual(response.body.endpoints, undefined);
                    assert.notDeepStrictEqual(response.body.actions, undefined);
                    assert.notDeepStrictEqual(response.body.mesh, undefined);
                    assert.notDeepStrictEqual(response.body.serviceRegistry, undefined);
                    done(error);
                });
            });
        });
    });

    mocha.describe('Service Registry Test', () => {
        mocha.describe('Creation Test', () => {
            mocha.it('should register unique name', () => {
                const shieldMesh = new Mesh();
                const shieldProxy = new Proxy();
                const shieldSVC = new Service({ name: 'ShieldSVC', logPath: logPath, mesh: shieldMesh, proxy: shieldProxy });
                silentLog(shieldSVC);

                //Registry
                shieldSVC.discover('HydraSVC');

                //Validate ServiceRegistry, Mesh & Proxy.
                assert.deepStrictEqual(shieldSVC.serviceRegistry.remoteServices.length, 1);
                assert.deepStrictEqual(shieldSVC.serviceRegistry.remoteServices[0].defined, true);
                assert.deepStrictEqual(shieldSVC.serviceRegistry.remoteServices[0].name, 'HydraSVC');
                assert.deepStrictEqual(shieldSVC.serviceRegistry.remoteServices[0].alias, undefined);
                assert.notDeepStrictEqual(shieldMesh.HydraSVC, undefined);
                assert.notDeepStrictEqual(shieldProxy.HydraSVC, undefined);
            });

            mocha.it('should not register duplicate name', () => {
                const shieldMesh = new Mesh();
                const shieldProxy = new Proxy();
                const shieldSVC = new Service({ name: 'ShieldSVC', logPath: logPath, mesh: shieldMesh, proxy: shieldProxy });
                silentLog(shieldSVC);

                //Registry
                shieldSVC.discover('HydraSVC');
                shieldSVC.discover('HydraSVC');

                //Validate ServiceRegistry, Mesh & Proxy.
                assert.deepStrictEqual(shieldSVC.serviceRegistry.remoteServices.length, 1);
                assert.deepStrictEqual(shieldSVC.serviceRegistry.remoteServices[0].defined, true);
                assert.deepStrictEqual(shieldSVC.serviceRegistry.remoteServices[0].name, 'HydraSVC');
                assert.deepStrictEqual(shieldSVC.serviceRegistry.remoteServices[0].alias, undefined);
                assert.notDeepStrictEqual(shieldMesh.HydraSVC, undefined);
                assert.notDeepStrictEqual(shieldProxy.HydraSVC, undefined);
            });

            mocha.it('should register unique name with unique alias', () => {
                const shieldMesh = new Mesh();
                const shieldProxy = new Proxy();
                const shieldSVC = new Service({ name: 'ShieldSVC', logPath: logPath, mesh: shieldMesh, proxy: shieldProxy });
                silentLog(shieldSVC);

                //Registry
                shieldSVC.discover('HydraSVC', 'Hydra');

                //Validate ServiceRegistry, Mesh & Proxy.
                assert.deepStrictEqual(shieldSVC.serviceRegistry.remoteServices.length, 1);
                assert.deepStrictEqual(shieldSVC.serviceRegistry.remoteServices[0].defined, true);
                assert.deepStrictEqual(shieldSVC.serviceRegistry.remoteServices[0].name, 'HydraSVC');
                assert.deepStrictEqual(shieldSVC.serviceRegistry.remoteServices[0].alias, 'Hydra');
                assert.notDeepStrictEqual(shieldMesh.Hydra, undefined);
                assert.notDeepStrictEqual(shieldProxy.Hydra, undefined);
            });

            mocha.it('should not register duplicate name with unique alias', () => {
                const shieldMesh = new Mesh();
                const shieldProxy = new Proxy();
                const shieldSVC = new Service({ name: 'ShieldSVC', logPath: logPath, mesh: shieldMesh, proxy: shieldProxy });
                silentLog(shieldSVC);

                //Registry
                shieldSVC.discover('HydraSVC', 'Hydra');
                shieldSVC.discover('HydraSVC', 'Hydra1');

                //Validate ServiceRegistry, Mesh & Proxy.
                assert.deepStrictEqual(shieldSVC.serviceRegistry.remoteServices.length, 1);
                assert.deepStrictEqual(shieldSVC.serviceRegistry.remoteServices[0].defined, true);
                assert.deepStrictEqual(shieldSVC.serviceRegistry.remoteServices[0].name, 'HydraSVC');
                assert.deepStrictEqual(shieldSVC.serviceRegistry.remoteServices[0].alias, 'Hydra');
                assert.notDeepStrictEqual(shieldMesh.Hydra, undefined);
                assert.notDeepStrictEqual(shieldProxy.Hydra, undefined);
            });

            mocha.it('should not register unique name with duplicate alias', () => {
                const shieldMesh = new Mesh();
                const shieldProxy = new Proxy();
                const shieldSVC = new Service({ name: 'ShieldSVC', logPath: logPath, mesh: shieldMesh, proxy: shieldProxy });
                silentLog(shieldSVC);

                //Registry
                shieldSVC.discover('HydraSVC', 'Hydra');
                shieldSVC.discover('Hydra', 'Hydra');

                //Validate ServiceRegistry, Mesh & Proxy.
                assert.deepStrictEqual(shieldSVC.serviceRegistry.remoteServices.length, 1);
                assert.deepStrictEqual(shieldSVC.serviceRegistry.remoteServices[0].defined, true);
                assert.deepStrictEqual(shieldSVC.serviceRegistry.remoteServices[0].name, 'HydraSVC');
                assert.deepStrictEqual(shieldSVC.serviceRegistry.remoteServices[0].alias, 'Hydra');
                assert.notDeepStrictEqual(shieldMesh.Hydra, undefined);
                assert.notDeepStrictEqual(shieldProxy.Hydra, undefined);
            });

            mocha.it('should not register duplicate name with duplicate alias', () => {
                const shieldMesh = new Mesh();
                const shieldProxy = new Proxy();
                const shieldSVC = new Service({ name: 'ShieldSVC', logPath: logPath, mesh: shieldMesh, proxy: shieldProxy });
                silentLog(shieldSVC);

                //Registry
                shieldSVC.discover('HydraSVC', 'Hydra');
                shieldSVC.discover('HydraSVC', 'Hydra');

                //Validate ServiceRegistry, Mesh & Proxy.
                assert.deepStrictEqual(shieldSVC.serviceRegistry.remoteServices.length, 1);
                assert.deepStrictEqual(shieldSVC.serviceRegistry.remoteServices[0].defined, true);
                assert.deepStrictEqual(shieldSVC.serviceRegistry.remoteServices[0].name, 'HydraSVC');
                assert.deepStrictEqual(shieldSVC.serviceRegistry.remoteServices[0].alias, 'Hydra');
                assert.notDeepStrictEqual(shieldMesh.Hydra, undefined);
                assert.notDeepStrictEqual(shieldProxy.Hydra, undefined);
            });
        });

        mocha.describe('Discovered(Auto) Test', () => {
            const shieldMesh = new Mesh();
            const shieldProxy = new Proxy();
            const shieldSVC = new Service({ name: 'ShieldSVC', logPath: logPath, httpPort: 3001, scpPort: 6001, mesh: shieldMesh, proxy: shieldProxy });
            silentLog(shieldSVC);

            const hydraMesh = new Mesh();
            const hydraProxy = new Proxy();
            const hydraSVC = new Service({ name: 'HydraSVC', logPath: logPath, httpPort: 3002, scpPort: 6002, mesh: hydraMesh, proxy: hydraProxy });
            silentLog(hydraSVC);

            mocha.before((done) => {
                hydraSVC.start(done);
            });

            mocha.after((done) => {
                hydraSVC.stop(done);
            });

            mocha.it('shield should be available to hydra', (done) => {
                hydraSVC.on('available', (remoteService: RemoteService) => {
                    assert.deepStrictEqual(remoteService.name, 'ShieldSVC');
                    assert.deepStrictEqual(remoteService.alias, undefined);
                    assert.deepStrictEqual(remoteService.defined, false);
                    assert.deepStrictEqual(remoteService.scpClient.connected, true);
                    assert.deepStrictEqual(remoteService.scpClient.reconnecting, false);
                    assert.deepStrictEqual(remoteService.proxyClient.linked, true);

                    //Validate ServiceRegistry, Mesh & Proxy.
                    assert.deepStrictEqual(hydraSVC.serviceRegistry.remoteServices.length, 1);
                    assert.notDeepStrictEqual(hydraMesh.ShieldSVC, undefined);
                    assert.notDeepStrictEqual(hydraProxy.ShieldSVC, undefined);
                    done();
                });

                shieldSVC.start((error) => {
                    assert.deepStrictEqual(error, undefined);
                });
            });

            mocha.it('shield should be unavailable to hydra', (done) => {
                hydraSVC.on('unavailable', (remoteService: RemoteService) => {
                    assert.deepStrictEqual(remoteService.name, 'ShieldSVC');
                    assert.deepStrictEqual(remoteService.alias, undefined);
                    assert.deepStrictEqual(remoteService.defined, false);
                    assert.deepStrictEqual(remoteService.scpClient.connected, false);
                    assert.deepStrictEqual(remoteService.scpClient.reconnecting, false);
                    assert.deepStrictEqual(remoteService.proxyClient.linked, false);

                    //Validate ServiceRegistry, Mesh & Proxy.
                    assert.deepStrictEqual(hydraSVC.serviceRegistry.remoteServices.length, 1);
                    assert.notDeepStrictEqual(hydraMesh.ShieldSVC, undefined);
                    assert.notDeepStrictEqual(hydraProxy.ShieldSVC, undefined);
                    done();
                });

                shieldSVC.stop((error) => {
                    assert.deepStrictEqual(error, undefined);
                });
            });
        });

        mocha.describe('Discovered(Defined by name) Test', () => {
            const shieldMesh = new Mesh();
            const shieldProxy = new Proxy();
            const shieldSVC = new Service({ name: 'ShieldSVC', logPath: logPath, httpPort: 3001, scpPort: 6001, mesh: shieldMesh, proxy: shieldProxy });
            silentLog(shieldSVC);

            const hydraMesh = new Mesh();
            const hydraProxy = new Proxy();
            const hydraSVC = new Service({ name: 'HydraSVC', logPath: logPath, httpPort: 3002, scpPort: 6002, mesh: hydraMesh, proxy: hydraProxy });
            silentLog(hydraSVC);

            //Define with name.
            hydraSVC.discover('ShieldSVC');

            mocha.before((done) => {
                hydraSVC.start(done);
            });

            mocha.after((done) => {
                hydraSVC.stop(done);
            });

            mocha.it('shield should be available to hydra', (done) => {
                hydraSVC.on('available', (remoteService: RemoteService) => {
                    assert.deepStrictEqual(remoteService.name, 'ShieldSVC');
                    assert.deepStrictEqual(remoteService.alias, undefined);
                    assert.deepStrictEqual(remoteService.defined, true);
                    assert.deepStrictEqual(remoteService.scpClient.connected, true);
                    assert.deepStrictEqual(remoteService.scpClient.reconnecting, false);
                    assert.deepStrictEqual(remoteService.proxyClient.linked, true);

                    //Validate ServiceRegistry, Mesh & Proxy.
                    assert.deepStrictEqual(hydraSVC.serviceRegistry.remoteServices.length, 1);
                    assert.notDeepStrictEqual(hydraMesh.ShieldSVC, undefined);
                    assert.notDeepStrictEqual(hydraProxy.ShieldSVC, undefined);
                    done();
                });

                shieldSVC.start((error) => {
                    assert.deepStrictEqual(error, undefined);
                });
            });

            mocha.it('shield should be unavailable to hydra', (done) => {
                hydraSVC.on('unavailable', (remoteService: RemoteService) => {
                    assert.deepStrictEqual(remoteService.name, 'ShieldSVC');
                    assert.deepStrictEqual(remoteService.alias, undefined);
                    assert.deepStrictEqual(remoteService.defined, true);
                    assert.deepStrictEqual(remoteService.scpClient.connected, false);
                    assert.deepStrictEqual(remoteService.scpClient.reconnecting, false);
                    assert.deepStrictEqual(remoteService.proxyClient.linked, false);

                    //Validate ServiceRegistry, Mesh & Proxy.
                    assert.deepStrictEqual(hydraSVC.serviceRegistry.remoteServices.length, 1);
                    assert.notDeepStrictEqual(hydraMesh.ShieldSVC, undefined);
                    assert.notDeepStrictEqual(hydraProxy.ShieldSVC, undefined);
                    done();
                });

                shieldSVC.stop((error) => {
                    assert.deepStrictEqual(error, undefined);
                });
            });
        });

        mocha.describe('Discovered(Defined by alias) Test', () => {
            const shieldMesh = new Mesh();
            const shieldProxy = new Proxy();
            const shieldSVC = new Service({ name: 'ShieldSVC', logPath: logPath, httpPort: 3001, scpPort: 6001, mesh: shieldMesh, proxy: shieldProxy });
            silentLog(shieldSVC);

            const hydraMesh = new Mesh();
            const hydraProxy = new Proxy();
            const hydraSVC = new Service({ name: 'HydraSVC', logPath: logPath, httpPort: 3002, scpPort: 6002, mesh: hydraMesh, proxy: hydraProxy });
            silentLog(hydraSVC);

            //Define with alias.
            hydraSVC.discover('ShieldSVC', 'Shield');

            mocha.before((done) => {
                hydraSVC.start(done);
            });

            mocha.after((done) => {
                hydraSVC.stop(done);
            });

            mocha.it('shield should be available to hydra', (done) => {
                hydraSVC.on('available', (remoteService: RemoteService) => {
                    assert.deepStrictEqual(remoteService.name, 'ShieldSVC');
                    assert.deepStrictEqual(remoteService.alias, 'Shield');
                    assert.deepStrictEqual(remoteService.defined, true);
                    assert.deepStrictEqual(remoteService.scpClient.connected, true);
                    assert.deepStrictEqual(remoteService.scpClient.reconnecting, false);
                    assert.deepStrictEqual(remoteService.proxyClient.linked, true);

                    //Validate ServiceRegistry, Mesh & Proxy.
                    assert.deepStrictEqual(hydraSVC.serviceRegistry.remoteServices.length, 1);
                    assert.notDeepStrictEqual(hydraMesh.Shield, undefined);
                    assert.notDeepStrictEqual(hydraProxy.Shield, undefined);
                    done();
                });

                shieldSVC.start((error) => {
                    assert.deepStrictEqual(error, undefined);
                });
            });

            mocha.it('shield should be unavailable to hydra', (done) => {
                hydraSVC.on('unavailable', (remoteService: RemoteService) => {
                    assert.deepStrictEqual(remoteService.name, 'ShieldSVC');
                    assert.deepStrictEqual(remoteService.alias, 'Shield');
                    assert.deepStrictEqual(remoteService.defined, true);
                    assert.deepStrictEqual(remoteService.scpClient.connected, false);
                    assert.deepStrictEqual(remoteService.scpClient.reconnecting, false);
                    assert.deepStrictEqual(remoteService.proxyClient.linked, false);

                    //Validate ServiceRegistry, Mesh & Proxy.
                    assert.deepStrictEqual(hydraSVC.serviceRegistry.remoteServices.length, 1);
                    assert.notDeepStrictEqual(hydraMesh.Shield, undefined);
                    assert.notDeepStrictEqual(hydraProxy.Shield, undefined);
                    done();
                });

                shieldSVC.stop((error) => {
                    assert.deepStrictEqual(error, undefined);
                });
            });
        });
    });

    mocha.describe('Remote Service Test', () => {
        const jarvisMesh = new Mesh();
        const jarvisProxy = new Proxy();
        const jarvisSVC = new Service({ name: 'Jarvis', logPath: logPath, httpPort: 3001, scpPort: 6001, mesh: jarvisMesh, proxy: jarvisProxy });
        jarvisSVC.discover('Armor');
        silentLog(jarvisSVC);

        const armorSVC = new Service({ name: 'Armor', logPath: logPath, httpPort: 3002, scpPort: 6002 });
        silentLog(armorSVC);

        mocha.before((done) => {
            jarvisSVC.on('available', (remoteService: RemoteService) => {
                assert.deepStrictEqual(remoteService.name, 'Armor');
                done();
            });

            jarvisSVC.start((error) => {
                assert.deepStrictEqual(error, undefined);
                armorSVC.start((error) => {
                    assert.deepStrictEqual(error, undefined);
                });
            });
        });

        mocha.after((done) => {
            jarvisSVC.stop((error) => {
                assert.deepStrictEqual(error, undefined);
                armorSVC.stop(done);
            });
        });

        mocha.describe('SCP Test', () => {
            //Server
            armorSVC.reply('IronLegion.getAll', (message, reply) => {
                const ironLegions = new Array();
                for (let mark = 0; mark < 33; mark++) {
                    ironLegions.push(`Mark ${mark}`);
                }
                reply.send(ironLegions);
            });

            armorSVC.defineBroadcast('IronLegion.housePartyProtocol');

            //Client
            mocha.it('should execute #Jarvis(Armor.IronLegion.getAll()) and receive reply', async () => {
                const ironLegions: Body = await jarvisMesh.Armor.IronLegion.getAll();
                assert.deepStrictEqual(ironLegions.length, 33);
            }).timeout(1000 * 5);

            mocha.it('should receive broadcast on IronLegion.housePartyProtocol', (done) => {
                jarvisMesh.Armor.once('IronLegion.housePartyProtocol', (status: Body) => {
                    assert.deepStrictEqual(status, { send: true });

                    done();
                });

                //Trigger broadcast.
                armorSVC.broadcast('IronLegion.housePartyProtocol', { send: true });
            });
        });

        mocha.describe('Proxy Test', () => {
            const armorMiddleware: RequestHandler = (request, response, next) => {
                //Pass proxy variables to next.
                (request as any).proxy.m1 = 1;
                (request as any).proxy.m2 = 'Armor';
                (request as any).proxy.m3 = true;
                (request as any).proxy.m4 = ['Armor'];
                (request as any).proxy.m5 = { armor: true }

                next();
            }

            //Server Jarvis
            const jarvisRouter = jarvisSVC.createRouter('/armor');
            jarvisRouter.all('/powers', armorMiddleware, jarvisProxy.Armor('/features'));
            jarvisRouter.all('/*', armorMiddleware, jarvisProxy.Armor());

            //Server Armor
            const armorRouter = armorSVC.createRouter('/');
            armorRouter.get('/busters', (request, response) => {
                //Validate proxy has passed variables.
                assert.deepStrictEqual((request as any).proxy.m1, 1);
                assert.deepStrictEqual((request as any).proxy.m2, 'Armor');
                assert.deepStrictEqual((request as any).proxy.m3, true);
                assert.deepStrictEqual((request as any).proxy.m4, ['Armor']);
                assert.deepStrictEqual((request as any).proxy.m5, { armor: true });

                response.status(HttpStatusCodes.OK).send({ armor: ['Thorbuster', 'Hulkbuster'] });
            }).get('/features', (request, response) => {
                //Validate proxy has passed variables.
                assert.deepStrictEqual((request as any).proxy.m1, 1);
                assert.deepStrictEqual((request as any).proxy.m2, 'Armor');
                assert.deepStrictEqual((request as any).proxy.m3, true);
                assert.deepStrictEqual((request as any).proxy.m4, ['Armor']);
                assert.deepStrictEqual((request as any).proxy.m5, { armor: true });

                response.status(HttpStatusCodes.OK).send({ features: ['Lightweight', 'Flight'] });
            });

            //Client
            mocha.it('should proxy(Direct) to GET(/armor/busters) and receive body(JSON) with CORS support', (done) => {
                httpRequest('127.0.0.1', 3001, 'GET', '/armor/busters', {}, true, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body, { armor: ['Thorbuster', 'Hulkbuster'] });
                    done(error);
                });
            });

            mocha.it('should proxy(Re-Direct) to GET(/armor/powers) and receive body(JSON) with CORS support', (done) => {
                httpRequest('127.0.0.1', 3001, 'GET', '/armor/powers', {}, true, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body, { features: ['Lightweight', 'Flight'] });
                    done(error);
                });
            });
        });
    });
});