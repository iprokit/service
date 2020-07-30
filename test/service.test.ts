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
            assert.deepEqual(service.name, 'HeroSVC');
            assert.deepEqual(service.version, Default.VERSION);
            assert.deepEqual(service.environment, Default.ENVIRONMENT);
            assert.deepEqual(service.httpPort, Default.HTTP_PORT);
            assert.deepEqual(service.scpPort, Default.SCP_PORT);
            assert.deepEqual(service.discoveryPort, Default.DISCOVERY_PORT);
            assert.deepEqual(service.discoveryIp, Default.DISCOVERY_IP);
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
                version: '2.0.0',
                environment: 'dev',
                httpPort: 1000,
                scpPort: 2000,
                discoveryPort: 3000,
                discoveryIp: '224.0.0.2',
                logPath: logPath,
                mesh: mesh,
                proxy: proxy
            }

            const service = new Service(options);

            //Options Variables.
            assert.deepEqual(service.name, 'HeroSVC');
            assert.deepEqual(service.version, '2.0.0');
            assert.deepEqual(service.environment, 'development');
            assert.deepEqual(service.httpPort, 1000);
            assert.deepEqual(service.scpPort, 2000);
            assert.deepEqual(service.discoveryPort, 3000);
            assert.deepEqual(service.discoveryIp, '224.0.0.2');
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
                assert.deepEqual(stopping, true);
                done();
            });

            service.stop(() => {
                assert.deepEqual(service.scpServer.listening, false);
                assert.deepEqual(service.scpClientManager.connected, {});
                assert.deepEqual(service.proxyClientManager.linked, {});
                assert.deepEqual(service.discovery.listening, false);
                assert.deepEqual(service.serviceRegistry.connected, undefined);
                assert.deepEqual(service.httpServer.listening, false);
            });
        });
    });

    mocha.describe('Create Route Test', () => {
        const service = new Service({ name: 'HeroSVC', version: '1.0.0', logPath: logPath });

        mocha.it('should create route', () => {
            const route = service.createRouter('/hero');

            assert.notDeepEqual(route, undefined);
            assert.deepEqual(service.routes.length, 1);
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
                assert.deepEqual(response.statusCode, HttpStatusCodes.OK);
                assert.deepEqual(response.body.name, 'HeroSVC');
                assert.deepEqual(response.body.version, '1.0.0');
                assert.deepEqual(response.body.httpServer, true);
                assert.deepEqual(response.body.scpServer, true);
                assert.deepEqual(response.body.discovery, true);
                assert.deepEqual(response.body.healthy, true);
                done(error);
            });
        });

        it('should execute GET(/report) and receive body(JSON)', (done) => {
            httpRequest('get', '/report', {}, true, (response, error) => {
                assert.deepEqual(response.statusCode, HttpStatusCodes.OK);
                assert.notDeepEqual(response.body.service, undefined);
                assert.notDeepEqual(response.body.endpoints, undefined);
                assert.notDeepEqual(response.body.actions, undefined);
                assert.notDeepEqual(response.body.mesh, undefined);
                assert.notDeepEqual(response.body.serviceRegistry, undefined);
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
                    assert.deepEqual(error.code, 'ERR_HTTP_HEADERS_SENT');
                }
            }, 200);
        });

        //Client
        it('should execute GET(/hero) and receive body(JSON) with CORS support', (done) => {
            httpRequest('get', '/hero', { hero: 'Iron Man' }, true, (response, error) => {
                assert.deepEqual(response.headers['access-control-allow-origin'], '*');
                assert.deepEqual(response.statusCode, HttpStatusCodes.OK);
                assert.deepEqual(response.body, { hero: 'Iron Man' });
                done(error);
            });
        });

        it('should execute POST(/hero) and receive Error(Not Found)', (done) => {
            httpRequest('post', '/hero', '', false, (response, error) => {
                assert.deepEqual(response.statusCode, HttpStatusCodes.NOT_FOUND);
                assert.deepEqual(response.body, 'Not Found');
                done(error);
            });
        });

        it('should execute POST(/hero) and receive Error(Service Unavailable)', (done) => {
            httpRequest('get', '/hero/timeout', '', false, (response, error) => {
                assert.deepEqual(response.statusCode, HttpStatusCodes.SERVICE_UNAVAILABLE);
                assert.deepEqual(response.body, 'Service Unavailable');
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
                    assert.deepEqual(remoteService.name, 'Hydra');
                    assert.deepEqual(remoteService.alias, undefined);
                    assert.deepEqual(remoteService.defined, false);
                    assert.deepEqual(remoteService.scpClient.connected, true);
                    assert.deepEqual(remoteService.scpClient.reconnecting, false);
                    assert.deepEqual(remoteService.proxyClient.linked, true);
                    done();
                });

                hydra.start(() => {
                    shield.start();
                });
            });
        });

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
                    assert.deepEqual(remoteService.name, 'Hydra');
                    assert.deepEqual(remoteService.defined, false);
                    assert.deepEqual(remoteService.alias, undefined);
                    assert.deepEqual(remoteService.defined, false);
                    assert.deepEqual(remoteService.scpClient.connected, false);
                    assert.deepEqual(remoteService.scpClient.reconnecting, false);
                    assert.deepEqual(remoteService.proxyClient.linked, false);
                    done();
                });

                hydra.stop(() => {
                    shield.stop();
                });
            });
        });
    });

    // mocha.describe('Proxy Test', () => {
    //     //TODO: Implement this.
    // });
});

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