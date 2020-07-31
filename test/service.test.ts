//Import @iprotechs Modules
import { Mesh } from '@iprotechs/scp';

//Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import http, { RequestOptions, IncomingMessage } from 'http';

//Import Local.
import Default from '../lib/default';
import Service, { Options, RemoteService } from '../lib/service';
import { Proxy } from '../lib/proxy.client.manager';
import HttpStatusCodes from '../lib/http.statusCodes';

const hostname = '10.0.0.181';
const port = 3000;
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
            assert.notDeepStrictEqual(service.routes, undefined);
        });

        mocha.it('should construct Service with custom(Truthy) variables.', () => {
            const mesh = new Mesh();
            const proxy = new Proxy();

            const options: Options = {
                name: 'HeroSVC',
                version: '2.0.0',
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
            assert.deepStrictEqual(service.version, '2.0.0');
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
            assert.notDeepStrictEqual(service.routes, undefined);
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
            assert.notDeepStrictEqual(service.routes, undefined);
        });
    });

    mocha.describe('#start() & starting/started Event Test', () => {
        const service = new Service({ name: 'HeroSVC', version: '1.0.0', logPath: logPath });
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

            service.start(() => {
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
        const service = new Service({ name: 'HeroSVC', version: '1.0.0', logPath: logPath });
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

            service.stop(() => {
                assert.deepStrictEqual(service.scpServer.listening, false);
                assert.deepStrictEqual(service.scpClientManager.connected, {});
                assert.deepStrictEqual(service.proxyClientManager.linked, {});
                assert.deepStrictEqual(service.discovery.listening, false);
                assert.deepStrictEqual(service.serviceRegistry.connected, undefined);
                assert.deepStrictEqual(service.httpServer.listening, false);
            });
        });
    });

    mocha.describe('Service Registry Test', () => {
        mocha.describe('Availability Test', () => {
            const shield = new Service({ name: 'Shield', version: '1.0.0', logPath: logPath, httpPort: 3001, scpPort: 6001 });
            silentLog(shield);

            const hydra = new Service({ name: 'Hydra', version: '1.0.0', logPath: logPath, httpPort: 3002, scpPort: 6002 });
            silentLog(hydra);

            mocha.after((done) => {
                shield.stop(() => {
                    hydra.stop(done);
                });
            });

            mocha.it('hydra should be available to shield', (done) => {
                shield.on('available', (remoteService: RemoteService) => {
                    assert.deepStrictEqual(remoteService.name, 'Hydra');
                    assert.deepStrictEqual(remoteService.alias, undefined);
                    assert.deepStrictEqual(remoteService.defined, false);
                    assert.deepStrictEqual(remoteService.scpClient.connected, true);
                    assert.deepStrictEqual(remoteService.scpClient.reconnecting, false);
                    assert.deepStrictEqual(remoteService.proxyClient.linked, true);
                    done();
                });

                hydra.start(() => {
                    shield.start();
                });
            }).timeout(1000 * 5);
        });

        mocha.describe('Unavailability Test', () => {
            const shield = new Service({ name: 'Shield', version: '1.0.0', logPath: logPath, httpPort: 3001, scpPort: 6001 });
            silentLog(shield);

            const hydra = new Service({ name: 'Hydra', version: '1.0.0', logPath: logPath, httpPort: 3002, scpPort: 6002 });
            silentLog(hydra);

            mocha.before((done) => {
                shield.start(() => {
                    hydra.start(done);
                });
            });

            mocha.it('hydra should be unavailable to shield', (done) => {
                shield.on('unavailable', (remoteService: RemoteService) => {
                    assert.deepStrictEqual(remoteService.name, 'Hydra');
                    assert.deepStrictEqual(remoteService.defined, false);
                    assert.deepStrictEqual(remoteService.alias, undefined);
                    assert.deepStrictEqual(remoteService.defined, false);
                    assert.deepStrictEqual(remoteService.scpClient.connected, false);
                    assert.deepStrictEqual(remoteService.scpClient.reconnecting, false);
                    assert.deepStrictEqual(remoteService.proxyClient.linked, false);
                    done();
                });

                hydra.stop(() => {
                    shield.stop();
                });
            }).timeout(1000 * 5);
        });
    });

    mocha.describe('Express Test', () => {
        const service = new Service({ name: 'HeroSVC', version: '1.0.0', logPath: logPath });
        silentLog(service);

        mocha.before((done) => {
            service.start(done);
        });

        mocha.after((done) => {
            service.stop(done);
        });

        mocha.describe('Creation + Middleware Test', () => {
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
            }).get('/snap', (request, response) => {
                assert.deepStrictEqual(request.body.hero, true);

                response.setTimeout(100);
                setTimeout(() => {
                    try {
                        response.status(HttpStatusCodes.OK).send(request.body);
                    } catch (error) {
                        assert.deepStrictEqual(error.code, 'ERR_HTTP_HEADERS_SENT');
                    }
                }, 200);
            });

            //After Routes.
            heroRouter.use('/', (request, response) => {
                assert.deepStrictEqual(request.body.hero, true);

                response.status(HttpStatusCodes.NOT_FOUND).send('No Hero Route Found');
            });

            //Client
            mocha.it('should execute GET(/hero) and receive body(JSON) with CORS support', (done) => {
                httpRequest('get', '/hero', {}, true, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body, { heros: ['Captain America', 'Iron Man', 'Black Widow'] });
                    done(error);
                });
            });

            mocha.it('should execute POST(/hero) and receive body(JSON) with CORS support', (done) => {
                httpRequest('post', '/hero', {}, true, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.CREATED);
                    assert.deepStrictEqual(response.body, { hero: 'Vision' });
                    done(error);
                });
            });

            mocha.it('should execute PUT(/hero) and receive body(JSON) with CORS support', (done) => {
                httpRequest('put', '/hero', {}, true, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                    assert.deepStrictEqual(response.body, { hero: 'Thor' });
                    done(error);
                });
            });

            mocha.it('should execute GET(/hero/snap) and receive Error(Service Unavailable) with CORS support', (done) => {
                httpRequest('get', '/hero/snap', '', false, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.SERVICE_UNAVAILABLE);
                    assert.deepStrictEqual(response.body, 'Service Unavailable');
                    done(error);
                });
            });
            
            mocha.it('should execute DELETE(/hero) and receive Error(Not Found) with CORS support', (done) => {
                httpRequest('delete', '/hero', '', false, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.NOT_FOUND);
                    assert.deepStrictEqual(response.body, 'No Hero Route Found');
                    done(error);
                });
            });

            mocha.it('should execute GET(/) and receive Error(Not Found) with CORS support', (done) => {
                httpRequest('get', '/', '', false, (response, error) => {
                    assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                    assert.deepStrictEqual(response.statusCode, HttpStatusCodes.NOT_FOUND);
                    assert.deepStrictEqual(response.body, 'Not Found');
                    done(error);
                });
            });
        });

        mocha.describe('Default Routes Test', () => {
            mocha.it('should execute GET(/health) and receive body(JSON)', (done) => {
                httpRequest('get', '/health', {}, true, (response, error) => {
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
                httpRequest('get', '/report', {}, true, (response, error) => {
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
});

/**
 * TODO: 
 * Reply, define, broadcast - creation and call test.
 * Discover - creation and call test.
 * Proxy test
 */

//////////////////////////////
//////Helpers
//////////////////////////////
function silentLog(service: Service) {
    service.logger.transports.forEach((transport) => (transport.silent = true));
}

//////////////////////////////
//////HTTP Client
//////////////////////////////
//TODO: Move this into src as http.client.ts
function httpRequest(method: string, path: string, body: any, json: boolean, callback: (response: HttpResponse, error?: Error) => void) {
    body = (json === true) ? JSON.stringify(body) : body;
    const requestOptions: RequestOptions = {
        hostname: hostname,
        port: port,
        path: path,
        method: method,
        headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body)
        }
    }

    const request = http.request(requestOptions, (incomingMessage: HttpResponse) => {
        let chunks: string = '';
        incomingMessage.on('error', (error) => {
            callback(undefined, error);
        });
        incomingMessage.on('data', (chunk) => {
            chunks += chunk;
        });
        incomingMessage.on('end', () => {
            incomingMessage.body = (json === true) ? JSON.parse(chunks.toString()) : chunks.toString();
            callback(incomingMessage);
        });
    });
    request.on('error', (error) => {
        callback(undefined, error);
    });
    request.write(body);
    request.end();
}

interface HttpResponse extends IncomingMessage {
    body?: any;
}