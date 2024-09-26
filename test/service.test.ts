//Import Libs.
import mocha from 'mocha';
import assert from 'assert';

//Import Local.
import Service, { HttpStatusCode } from '../lib';
import { createString, createIdentifier, clientRequest, clientOnBroadcast, clientOmni } from './util';

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
            assert.deepStrictEqual(service.memberships.size, 0);
            assert.deepStrictEqual(service.localAddress, null);
            service.on('start', () => {
                start++;
                assert.deepStrictEqual(service.listening, { http: true, scp: true, sdp: true });
                assert.deepStrictEqual(service.address().http.port, httpPort);
                assert.deepStrictEqual(service.address().scp.port, scpPort);
                assert.deepStrictEqual(service.address().sdp.port, sdpPort);
                assert.deepStrictEqual(service.memberships.has(sdpAddress), true);
                assert.notDeepStrictEqual(service.localAddress, null);
            });
            service.on('stop', () => {
                stop++;
                assert.deepStrictEqual(service.listening, { http: false, scp: false, sdp: false });
                assert.deepStrictEqual(service.address(), { http: null, scp: null, sdp: null });
                assert.deepStrictEqual(service.memberships.size, 0);
                assert.deepStrictEqual(service.localAddress, null);
            });
            await service.start(httpPort, scpPort, sdpPort, sdpAddress);
            await service.stop(); //Calling End
            assert.deepStrictEqual(start, stop);
        });
    });

    mocha.describe('Connection Test', () => {
        const validate = (services: Array<Service>, status: boolean, count: number) => {
            for (const service of services) {
                assert.deepStrictEqual(service.listening, { http: status, scp: status, sdp: status });
                assert.deepStrictEqual(service.links.size, count - 1);
                service.links.forEach((link) => {
                    assert.deepStrictEqual(link.httpProxy.configured, status);
                    assert.deepStrictEqual(link.scpClient.connected, status);
                });
            }
        }

        mocha.it('should link to other services on start/stop', async () => {
            const serviceCount = 20, halfCount = 10;
            const restartCount = 5;
            const identifiers = Array(serviceCount).fill({}).map(() => createIdentifier());

            //Initialize
            let half: Array<Service>;
            const services = Array(serviceCount).fill({}).map((_, i) => new Service(identifiers[i]).linkTo(...identifiers.filter((_, j) => i !== j)));
            validate(services, false, serviceCount);

            //Start(All)
            await Promise.all([...services.map((service, i) => service.start(httpPort + i, scpPort + i, sdpPort, sdpAddress))]);
            validate(services, true, serviceCount);

            for (let i = 0; i < restartCount; i++) {
                //Stop(Half)
                half = services.slice(0, halfCount);
                await Promise.all([...half.map((service) => service.stop())]);
                validate(half, false, serviceCount);

                //Re-Initialize(Half)
                for (let i = 0; i < halfCount; i++) services[i] = new Service(identifiers[i]).linkTo(...identifiers.filter((_, j) => i !== j));
                validate(half, false, serviceCount);

                //Start(Half)
                half = services.slice(0, halfCount);
                await Promise.all([...half.map((service, i) => service.start(httpPort + i, scpPort + i, sdpPort, sdpAddress))]);
                validate(half, true, serviceCount);
            }

            //Stop(All)
            await Promise.all([...services.map((service) => service.stop())]);
            validate(services, false, serviceCount);
        });
    });

    mocha.describe('Link Test', () => {
        let serviceA: Service, serviceB: Service;

        mocha.beforeEach(async () => {
            serviceA = new Service('serviceA');
            serviceA.linkTo('serviceB');

            serviceB = new Service('serviceB');
            serviceB.linkTo('serviceA');

            await Promise.all([serviceA.start(httpPort, scpPort, sdpPort, sdpAddress), serviceB.start(httpPort + 1, scpPort + 1, sdpPort, sdpAddress)]);
        });

        mocha.afterEach(async () => {
            await Promise.all([serviceA.stop(), serviceB.stop()]);
        });

        mocha.it('should forward request to remote service', async () => {
            //Server
            const linkB = serviceA.linkOf('serviceB');
            serviceA.post('/endpoint', linkB.forward());

            //Server Target
            serviceB.post('/endpoint', async (request, response, next) => {
                assert.deepStrictEqual(request.method, 'POST');
                assert.deepStrictEqual(request.url, '/endpoint');
                request.pipe(response).writeHead(HttpStatusCode.OK);
            });

            //Client
            const requestBody = createString(1000);
            const { response, body: responseBody } = await clientRequest(serviceA.localAddress!, httpPort, 'POST', '/endpoint', requestBody);
            assert.deepStrictEqual(response.statusCode, HttpStatusCode.OK);
            assert.deepStrictEqual(responseBody, requestBody);
        });

        mocha.it('should receive broadcast from remote service', async () => {
            //Server
            const arg = createString(1000);
            serviceA.broadcast('nexus1', arg);

            //Client
            const linkA = serviceB.linkOf('serviceA');
            const argsResolved = await clientOnBroadcast(linkA, 'nexus1', 1);
            assert.deepStrictEqual(argsResolved, [arg]);
        });

        mocha.it('should receive data(OMNI) from remote service', async () => {
            //Server
            serviceA.omni('nexus', async (incoming, outgoing, proceed) => {
                incoming.pipe(outgoing);
            });

            //Client
            const outgoingData = createString(1000);
            const linkA = serviceB.linkOf('serviceA');
            const { incoming, data: incomingData } = await clientOmni(linkA, 'nexus', outgoingData);
            assert.deepStrictEqual(incoming.mode, 'OMNI');
            assert.deepStrictEqual(incoming.operation, 'nexus');
            assert.deepStrictEqual(incoming.get('SID'), serviceA.identifier);
            assert.deepStrictEqual(incomingData, outgoingData);
        });

        mocha.it('should execute remote function from remote service', async () => {
            //Server
            serviceA.func('nexus', async (arg) => {
                return arg;
            });

            //Client
            const arg = createString(1000);
            const linkA = serviceB.linkOf('serviceA');
            const returned = await linkA.execute('nexus', arg);
            assert.deepStrictEqual(returned, arg);
        });

        mocha.it('should throw SERVICE_LINK_INVALID_IDENTIFIER', async () => {
            //Client
            try {
                const linkC = serviceB.linkOf('serviceC');
            } catch (error) {
                assert.deepStrictEqual((error as Error).message, 'SERVICE_LINK_INVALID_IDENTIFIER');
            }
        });
    });
});