//Import Libs.
import mocha from 'mocha';
import assert from 'assert';

//Import Local.
import { RequestHandler, HttpStatusCode, Args, IncomingHandler, Service } from '../lib';
import { createString, createIdentifier, clientRequest, serviceOnBroadcast, serviceMessage } from './util';

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
            assert.deepStrictEqual(service.remotes.length, 0);
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
                    assert.deepStrictEqual(link.scpClient.connected, status);
                    if (status) {
                        assert.notDeepStrictEqual(link.proxyOptions, { host: undefined, port: undefined });
                    } else {
                        assert.deepStrictEqual(link.proxyOptions, { host: undefined, port: undefined });
                    }
                });
            }
        }

        mocha.it('should link to other services on start/stop', async () => {
            const serviceCount = 20, halfCount = 10;
            const restartCount = 5;
            const identifiers = Array(serviceCount).fill({}).map(() => createIdentifier());

            //Initialize
            let half: Array<Service>;
            const services = Array(serviceCount).fill({}).map((_, i) => new Service(identifiers[i]).link(...identifiers.filter((_, j) => i !== j)));
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
                for (let i = 0; i < halfCount; i++) services[i] = new Service(identifiers[i]).link(...identifiers.filter((_, j) => i !== j));
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

        const requestHandler: RequestHandler = async (request, response, next) => {
            let body = '';
            for await (const chunk of request) {
                body += chunk;
            }
            response.writeHead(HttpStatusCode.OK).end(body);
        }

        const incomingHandler: IncomingHandler = (incoming, outgoing, proceed) => {
            incoming.pipe(outgoing);
            incoming.on('signal', (event: string, args: Args) => outgoing.signal(event, args));
        }

        mocha.beforeEach(async () => {
            serviceA = new Service('SVC_A');
            serviceA.link('SVC_B');
            serviceA.proxy('/a/*', 'SVC_B');

            serviceB = new Service('SVC_B');
            serviceB.link('SVC_A');
            serviceB.post('/b1', requestHandler);
            serviceB.post('/b2', requestHandler);
            serviceB.post('/b3', requestHandler);
            serviceB.reply('echo', incomingHandler);

            await Promise.all([serviceA.start(httpPort, scpPort, sdpPort, sdpAddress), serviceB.start(httpPort + 1, scpPort + 1, sdpPort, sdpAddress)]);
        });

        mocha.afterEach(async () => {
            await Promise.all([serviceA.stop(), serviceB.stop()]);
        });

        mocha.describe('Proxy Test', () => {
            mocha.it('should proxy a request & response to the target service', async () => {
                //Client
                const requestBody = createString(1000);
                const { response, body: responseBody } = await clientRequest(serviceA.localAddress, httpPort, 'POST', '/a/b2', requestBody);
                assert.deepStrictEqual(response.statusCode, HttpStatusCode.OK);
                assert.deepStrictEqual(responseBody, requestBody);
            });

            mocha.it('should handle proxy request to an unavailable target service', async () => {
                //Server
                serviceA.link('SVC_C');
                serviceA.proxy('/b/*', 'SVC_C');

                //Client
                const requestBody = createString(1000);
                const { response, body: responseBody } = await clientRequest(serviceA.localAddress, httpPort, 'POST', '/b/c2', requestBody);
                assert.deepStrictEqual(response.statusCode, HttpStatusCode.INTERNAL_SERVER_ERROR);
                assert.deepStrictEqual(responseBody.includes('ECONNREFUSED'), true);
            });

            mocha.it('should throw SERVICE_LINK_INVALID_IDENTIFIER', () => {
                //Server
                try {
                    serviceA.proxy('/b/*', 'SVC_C');
                } catch (error) {
                    assert.deepStrictEqual(error.message, 'SERVICE_LINK_INVALID_IDENTIFIER');
                }
            });
        });

        mocha.describe('Broadcast Test', () => {
            mocha.it('should receive broadcast', async () => {
                //Server
                const outgoingData = createString(1000);
                serviceA.broadcast('function1', outgoingData, [['A', 'a']]);

                //Client
                const { data: incomingData, params } = await serviceOnBroadcast(serviceB, 'SVC_A', 'function1');
                assert.deepStrictEqual(incomingData, outgoingData);
                assert.deepStrictEqual(params.get('SID'), serviceA.identifier);
                assert.deepStrictEqual(params.get('A'), 'a');
            });

            mocha.it('should throw SERVICE_LINK_INVALID_IDENTIFIER', async () => {
                //Client
                try {
                    const { data: incomingData, params } = await serviceOnBroadcast(serviceB, 'SVC_C', 'function1');
                } catch (error) {
                    assert.deepStrictEqual(error.message, 'SERVICE_LINK_INVALID_IDENTIFIER');
                }
            });
        });

        mocha.describe('Message/Reply Test', () => {
            mocha.it('should receive reply to message', async () => {
                //Client
                const message = createString(1000);
                const { incoming, data: reply } = await serviceMessage(serviceA, 'SVC_B', 'echo', message);
                assert.deepStrictEqual(reply, message);
            });

            mocha.it('should throw SERVICE_LINK_INVALID_IDENTIFIER', async () => {
                //Client
                try {
                    const message = createString(1000);
                    const { incoming, data: reply } = await serviceMessage(serviceA, 'SVC_C', 'echo', message);
                } catch (error) {
                    assert.deepStrictEqual(error.message, 'SERVICE_LINK_INVALID_IDENTIFIER');
                }
            });
        });
    });
});