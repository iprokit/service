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
            service.stop(() => {
                done();
            });
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

    mocha.describe('Service Routes Test', () => {
        const service = new Service({ name: 'HeroSVC', version: '1.0.0', logPath: logPath });
        silentLog(service);

        mocha.before((done) => {
            service.start(done);
        });

        mocha.after((done) => {
            service.stop(() => {
                done();
            });
        });

        it('should execute GET(/health) and receive body(JSON)', (done) => {
            httpRequest('get', '/health', {}, true, (response, error) => {
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

        it('should execute GET(/report) and receive body(JSON)', (done) => {
            httpRequest('get', '/report', {}, true, (response, error) => {
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

    mocha.describe('Default Middleware Test', () => {
        const service = new Service({ name: 'HeroSVC', version: '1.0.0', logPath: logPath });
        silentLog(service);

        mocha.before((done) => {
            service.start(done);
        });

        mocha.after((done) => {
            service.stop(() => {
                done();
            });
        });

        //Server
        service.get('/hero', (request, respose) => {
            respose.status(HttpStatusCodes.OK).send(request.body);
        });

        service.get('/hero/timeout', (request, respose) => {
            respose.setTimeout(100);
            setTimeout(() => {
                try {
                    respose.status(HttpStatusCodes.OK).send(request.body);
                } catch (error) {
                    assert.deepStrictEqual(error.code, 'ERR_HTTP_HEADERS_SENT');
                }
            }, 200);
        });

        //Client
        it('should execute GET(/hero) and receive body(JSON) with CORS support', (done) => {
            httpRequest('get', '/hero', { hero: 'Iron Man' }, true, (response, error) => {
                assert.deepStrictEqual(response.headers['access-control-allow-origin'], '*');
                assert.deepStrictEqual(response.statusCode, HttpStatusCodes.OK);
                assert.deepStrictEqual(response.body, { hero: 'Iron Man' });
                done(error);
            });
        });

        it('should execute POST(/hero) and receive Error(Not Found)', (done) => {
            httpRequest('post', '/hero', '', false, (response, error) => {
                assert.deepStrictEqual(response.statusCode, HttpStatusCodes.NOT_FOUND);
                assert.deepStrictEqual(response.body, 'Not Found');
                done(error);
            });
        });

        it('should execute POST(/hero) and receive Error(Service Unavailable)', (done) => {
            httpRequest('get', '/hero/timeout', '', false, (response, error) => {
                assert.deepStrictEqual(response.statusCode, HttpStatusCodes.SERVICE_UNAVAILABLE);
                assert.deepStrictEqual(response.body, 'Service Unavailable');
                done(error);
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
                    hydra.stop(() => {
                        done();
                    });
                });
            });

            mocha.it('Service(hydra) should be available to Service(shield)', (done) => {
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
            });
        }).timeout(1000 * 5);

        mocha.describe('Unavailability Test', () => {
            const shield = new Service({ name: 'Shield', version: '1.0.0', logPath: logPath, httpPort: 3001, scpPort: 6001 });
            silentLog(shield);

            const hydra = new Service({ name: 'Hydra', version: '1.0.0', logPath: logPath, httpPort: 3002, scpPort: 6002 });
            silentLog(hydra);

            mocha.before((done) => {
                shield.start(() => {
                    hydra.start(() => {
                        done();
                    });
                });
            });

            mocha.it('Service(hydra) should be unavailable to Service(shield)', (done) => {
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
            });
        }).timeout(1000 * 5);
    });

    mocha.describe('Creation Test', () => {
        mocha.it('should create route', () => {
            const service = new Service({ name: 'HeroSVC', version: '1.0.0', logPath: logPath });
            const route = service.createRouter('/hero');

            assert.notDeepStrictEqual(route, undefined);
            assert.deepStrictEqual(service.routes.length, 1);
        });
    });
});

/**
 * TODO: 
 * Use, all, get, post, put, delete - creation and call test. With use before and after test.
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