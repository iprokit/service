// Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';

// Import Local.
import Service, { HttpMethod, HttpStatusCode, ScpMode, Link } from '../lib';
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
            assert.deepStrictEqual(service.links.size, 0);
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
            identifiers.forEach((identifier, j) => (i !== j) && service.Link(identifier));
            return service;
        }

        const validate = (services: Array<Service>, status: boolean, count: number) => {
            for (const service of services) {
                assert.deepStrictEqual(service.listening, { http: status, scp: status, sdp: status });
                assert.deepStrictEqual(service.links.size, count - 1);
                service.links.forEach((link) => {
                    assert.notDeepStrictEqual(link.identifier, service.identifier);
                    assert.deepStrictEqual(link.httpProxy.identifier, service.identifier);
                    assert.deepStrictEqual(link.httpProxy.configured, status);
                    assert.deepStrictEqual(link.scpClient.identifier, service.identifier);
                    assert.deepStrictEqual(link.scpClient.connected, status);
                });
            }
        }

        mocha.it('should link to other services on start/stop', async () => {
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

    mocha.describe('Link Test', () => {
        let serviceA: Service, serviceB: Service;
        let linkA: Link, linkB: Link;

        mocha.beforeEach(async () => {
            serviceA = new Service('serviceA');
            linkB = serviceA.Link('serviceB');

            serviceB = new Service('serviceB');
            linkA = serviceB.Link('serviceA');

            await Promise.all([serviceA.start(httpPort, scpPort, sdpPort, sdpAddress), serviceB.start(httpPort + 1, scpPort + 1, sdpPort, sdpAddress)]);
        });

        mocha.afterEach(async () => {
            await Promise.all([serviceA.stop(), serviceB.stop()]);
        });

        mocha.it('should not create duplicate link', () => {
            const linkB1 = serviceA.Link('serviceB');

            assert.deepStrictEqual(linkB, linkB1);
            assert.deepStrictEqual(serviceA.links.size, 1);
        });

        mocha.it('should forward request to remote service', async () => {
            // Server
            serviceA.post('/endpoint', linkB.forward());

            // Server Target
            serviceB.post('/endpoint', (request, response, next) => {
                assert.deepStrictEqual(request.method, HttpMethod.POST);
                assert.deepStrictEqual(request.url, '/endpoint');
                assert.deepStrictEqual(request.headers['x-proxy-identifier'], serviceA.identifier);
                request.pipe(response).writeHead(HttpStatusCode.OK);
            });

            // Client
            const requestBody = createString(1000);
            const { response, body: responseBody } = await clientRequest(serviceA.localAddress!, httpPort, HttpMethod.POST, '/endpoint', requestBody);
            assert.deepStrictEqual(response.statusCode, HttpStatusCode.OK);
            assert.deepStrictEqual(responseBody, requestBody);
        });

        mocha.it('should receive broadcast from remote service', async () => {
            // Server
            const arg = createString(1000);
            const [identifier] = await serviceA.broadcast('nexus1', arg);
            assert.deepStrictEqual(identifier, serviceB.identifier);

            // Client
            const argsResolved = await once(linkA, 'nexus1');
            assert.deepStrictEqual(argsResolved, [arg]);
        });

        mocha.it('should receive data(OMNI) from remote service', async () => {
            // Server
            serviceA.omni('nexus', async (incoming, outgoing, proceed) => {
                incoming.pipe(outgoing);
            });

            // Client
            const outgoingData = createString(1000);
            const { incoming, data: incomingData } = await clientOmni(linkA, 'nexus', outgoingData);
            assert.deepStrictEqual(incoming.mode, ScpMode.OMNI);
            assert.deepStrictEqual(incoming.operation, 'nexus');
            assert.deepStrictEqual(incoming.get('SID'), serviceA.identifier);
            assert.deepStrictEqual(incomingData, outgoingData);
        });

        mocha.it('should execute function on remote service', async () => {
            // Server
            serviceA.func('nexus', async (arg) => {
                return arg;
            });

            // Client
            const arg = createString(1000);
            const returned = await linkA.execute('nexus', arg);
            assert.deepStrictEqual(returned, arg);
        });
    });
});