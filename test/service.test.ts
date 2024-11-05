// Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';

// Import Local.
import Service, { Remote, HTTP } from '../lib';
import { createString, createIdentifier, clientRequest, clientOmni } from './util';

const httpPort = 3000;
const scpPort = 6000;
const sdpPort = 5000;
const sdpAddress = '224.0.0.2';

mocha.describe('Service Test', () => {
    mocha.describe('Constructor Test', () => {
        mocha.it('should construct service', () => {
            const identifier = createIdentifier();
            const service = new Service(identifier);
            assert.deepStrictEqual(service.identifier, identifier);
            assert.deepStrictEqual(service.remotes.size, 0);
            assert.deepStrictEqual(service.routes.length, 0);
            assert.deepStrictEqual(service.executions.length, 0);
        });
    });

    mocha.describe('Start/Stop Test', () => {
        mocha.it('should emit start & stop events', async () => {
            let start = 0, stop = 0;

            const service = new Service(createIdentifier());
            assert.deepStrictEqual(service.listening, { http: false, scp: false, sdp: false });
            assert.deepStrictEqual(service.address(), { http: null, scp: null, sdp: null });
            assert.deepStrictEqual(service.memberships, []);
            assert.deepStrictEqual(service.localAddress, null);
            service.on('start', () => {
                start++;
                assert.deepStrictEqual(service.listening, { http: true, scp: true, sdp: true });
                assert.deepStrictEqual(service.address().http.port, httpPort);
                assert.deepStrictEqual(service.address().scp.port, scpPort);
                assert.deepStrictEqual(service.address().sdp.port, sdpPort);
                assert.deepStrictEqual(service.memberships, [sdpAddress]);
                assert.notDeepStrictEqual(service.localAddress, null);
            });
            service.on('stop', () => {
                stop++;
                assert.deepStrictEqual(service.listening, { http: false, scp: false, sdp: false });
                assert.deepStrictEqual(service.address(), { http: null, scp: null, sdp: null });
                assert.deepStrictEqual(service.memberships, []);
                assert.deepStrictEqual(service.localAddress, null);
            });
            await service.start(httpPort, scpPort, sdpPort, sdpAddress);
            await service.stop(); // Calling End
            assert.deepStrictEqual(start, stop);
        });
    });

    mocha.describe('Connection Test', () => {
        const initService = (identifiers: Array<string>, i: number) => {
            const service = new Service(identifiers[i]);
            identifiers.forEach((identifier, j) => {
                if (i !== j) {
                    const remote = new Remote(identifiers[i]);
                    service.link(identifier, remote);
                }
            });
            return service;
        }

        const validate = (services: Array<Service>, status: boolean, count: number) => {
            for (const service of services) {
                assert.deepStrictEqual(service.listening, { http: status, scp: status, sdp: status });
                assert.deepStrictEqual(service.remotes.size, count - 1);
                service.remotes.forEach((remotes) => {
                    remotes.forEach((remote) => {
                        assert.deepStrictEqual(remote.identifier, service.identifier);
                        assert.deepStrictEqual(remote.httpProxy.identifier, service.identifier);
                        assert.deepStrictEqual(remote.httpProxy.configured, status);
                        assert.deepStrictEqual(remote.scpClient.identifier, service.identifier);
                        assert.deepStrictEqual(remote.scpClient.connected, status);
                    });
                    assert.deepStrictEqual(remotes.length, 1);
                });
            }
        }

        mocha.it('should link to remote services on start/stop', async () => {
            const serviceCount = 20, halfCount = 10;
            const restartCount = 5;
            const identifiers = Array(serviceCount).fill({}).map(() => createIdentifier());

            // Initialize
            let half: Array<Service>;
            const services = Array(serviceCount).fill({}).map((_, i) => initService(identifiers, i));

            validate(services, false, serviceCount);

            // Start(All)
            await Promise.all([...services.map((service, i) => service.start(httpPort + i, scpPort + i, sdpPort, sdpAddress))]);
            validate(services, true, serviceCount);

            for (let i = 0; i < restartCount; i++) {
                // Stop(Half)
                half = services.slice(0, halfCount);
                await Promise.all([...half.map((service) => service.stop())]);
                validate(half, false, serviceCount);

                // Re-Initialize(Half)
                for (let i = 0; i < halfCount; i++) services[i] = initService(identifiers, i);
                validate(half, false, serviceCount);

                // Start(Half)
                half = services.slice(0, halfCount);
                await Promise.all([...half.map((service, i) => service.start(httpPort + i, scpPort + i, sdpPort, sdpAddress))]);
                validate(half, true, serviceCount);
            }

            // Stop(All)
            await Promise.all([...services.map((service) => service.stop())]);
            validate(services, false, serviceCount);
        });
    });

    mocha.describe('Remote Test', () => {
        let serviceA: Service, serviceB: Service;
        let remoteToA: Remote, remoteToB: Remote;

        mocha.beforeEach(async () => {
            serviceA = new Service('serviceA');
            remoteToB = new Remote(serviceA.identifier);
            serviceA.link('serviceB', remoteToB);

            serviceB = new Service('serviceB');
            remoteToA = new Remote(serviceB.identifier);
            serviceB.link('serviceA', remoteToA);

            await Promise.all([serviceA.start(httpPort, scpPort, sdpPort, sdpAddress), serviceB.start(httpPort + 1, scpPort + 1, sdpPort, sdpAddress)]);
        });

        mocha.afterEach(async () => {
            await Promise.all([serviceA.stop(), serviceB.stop()]);
        });

        mocha.it('should create duplicate remotes', () => {
            const remoteToB1 = new Remote(createIdentifier());
            const remoteToB2 = new Remote(createIdentifier());
            serviceA.link('serviceB', remoteToB1, remoteToB2);
            assert.deepStrictEqual(serviceA.remotes.size, 1);
            assert.deepStrictEqual(serviceA.remotes.get('serviceB')!.length, 1 + 2);
        });

        mocha.it('should forward request to remote service', async () => {
            // Server
            serviceA.post('/endpoint', remoteToB.forward());

            // Server Target
            serviceB.post('/endpoint', (request, response, next) => {
                assert.deepStrictEqual(request.method, 'POST');
                assert.deepStrictEqual(request.url, '/endpoint');
                assert.deepStrictEqual(request.headers['x-proxy-identifier'], serviceA.identifier);
                request.pipe(response).writeHead(HTTP.StatusCode.OK);
            });

            // Client
            const requestBody = createString(1000);
            const { response, body: responseBody } = await clientRequest(serviceA.localAddress!, httpPort, 'POST', '/endpoint', requestBody);
            assert.deepStrictEqual(response.headers['x-server-identifier'], serviceB.identifier);
            assert.deepStrictEqual(response.headers['x-proxy-identifier'], serviceA.identifier);
            assert.deepStrictEqual(response.statusCode, HTTP.StatusCode.OK);
            assert.deepStrictEqual(responseBody, requestBody);
        });

        mocha.it('should receive broadcast from remote service', async () => {
            // Server
            const arg = createString(1000);
            const [identifier] = await serviceA.broadcast('nexus1', arg);
            assert.deepStrictEqual(identifier, serviceB.identifier);

            // Client
            const argsResolved = await once(remoteToA, 'nexus1');
            assert.deepStrictEqual(argsResolved, [arg]);
        });

        mocha.it('should receive data(OMNI) from remote service', async () => {
            // Server
            serviceA.omni('nexus', async (incoming, outgoing, proceed) => {
                incoming.pipe(outgoing);
            });

            // Client
            const outgoingData = createString(1000);
            const { incoming, data: incomingData } = await clientOmni(remoteToA, 'nexus', outgoingData);
            assert.deepStrictEqual(incoming.mode, 'OMNI');
            assert.deepStrictEqual(incoming.operation, 'nexus');
            assert.deepStrictEqual(incoming.parameters['SID'], serviceA.identifier);
            assert.deepStrictEqual(incomingData, outgoingData);
        });

        mocha.it('should execute function on remote service', async () => {
            // Server
            serviceA.func('nexus', async (arg) => {
                return arg;
            });

            // Client
            const arg = createString(1000);
            const returned = await remoteToA.execute('nexus', arg);
            assert.deepStrictEqual(returned, arg);
        });
    });
});