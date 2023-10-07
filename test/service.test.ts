//Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';

//Import Local.
import { RequestHandler, HttpStatusCode, Service, Link } from '../lib';
import { createString, createIdentifier, clientRequest, on } from './util';

const httpPort = 3000;
const scpPort = 6000;
const sdpPort = 5000;
const address = '224.0.0.1';

mocha.describe('Service Test', () => {
    mocha.describe('Constructor Test', () => {
        mocha.it('should construct service', (done) => {
            const identifier = createIdentifier();
            const service = new Service(identifier);
            assert.deepStrictEqual(service.identifier, identifier);
            assert.deepStrictEqual(service.links.size, 0);
            assert.deepStrictEqual(service.routes.length, 0);
            assert.deepStrictEqual(service.remoteFunctions.length, 0);
            done();
        });
    });

    mocha.describe('Start/Stop Test', () => {
        mocha.it('should emit start & stop events multiple times', (done) => {
            const startCount = 20;
            let start = 0, stop = 0;

            const service = new Service(createIdentifier());
            assert.deepStrictEqual(service.listening, { http: false, scp: false, sdp: false });
            assert.deepStrictEqual(service.address(), { http: null, scp: null, sdp: null });
            assert.deepStrictEqual(service.memberships, null);
            assert.deepStrictEqual(service.localAddress, null);
            service.on('start', () => {
                start++;
                assert.deepStrictEqual(service.listening, { http: true, scp: true, sdp: true });
                assert.deepStrictEqual(service.address().http.port, httpPort);
                assert.deepStrictEqual(service.address().scp.port, scpPort);
                assert.deepStrictEqual(service.address().sdp.port, sdpPort);
                assert.deepStrictEqual(service.memberships, [address]);
                assert.notDeepStrictEqual(service.localAddress, null);
            });
            service.on('stop', () => {
                stop++;
                assert.deepStrictEqual(service.listening, { http: false, scp: false, sdp: false });
                assert.deepStrictEqual(service.address(), { http: null, scp: null, sdp: null });
                assert.deepStrictEqual(service.memberships, []);
                assert.deepStrictEqual(service.localAddress, null);
            });
            (async () => {
                for (let i = 0; i < startCount; i++) {
                    await service.start(httpPort, scpPort, sdpPort, address);
                    await service.stop(); //Calling End
                    assert.deepStrictEqual(start, stop);
                }
                done();
            })();
        });
    });

    mocha.describe('Connection Test', () => {
        let serviceA: Service;

        mocha.beforeEach(async () => {
            serviceA = new Service(createIdentifier());
            await serviceA.start(httpPort, scpPort, sdpPort, address);
        });

        mocha.afterEach(async () => {
            await serviceA.stop();
        });

        mocha.it('should emit connect & close events for single link', async () => {
            const serviceB = new Service(createIdentifier());
            const connects = new Set<string>(), closes = new Set<string>();

            //Start
            serviceB.start(httpPort + 1, scpPort + 1, sdpPort, address);
            const connectAB = await Promise.all([once(serviceA, 'connect'), once(serviceB, 'connect')]) as [[Link], [Link]];
            for (const [link] of connectAB) {
                if (!connects.has(link.scpClient.identifier)) connects.add(link.scpClient.identifier);
                assert.deepStrictEqual(link.scpClient.connected, true);
            }
            assert.deepStrictEqual(connects.size, 1 + 1); //servicesCount = A + B

            //Stop
            serviceB.stop();
            const closeA = await Promise.all([once(serviceA, 'close')]) as [[Link]];
            for (const [link] of closeA) {
                if (!closes.has(link.scpClient.identifier)) closes.add(link.scpClient.identifier);
                assert.deepStrictEqual(link.scpClient.connected, false);
            }
            assert.deepStrictEqual(closes.size, 1); //servicesCount = B

            assert.deepStrictEqual(serviceA.links.size, 1);
            assert.deepStrictEqual(serviceB.links.size, 1);
        });

        mocha.it('should emit connect & close events for multiple links', async () => {
            const serviceCount = 20;
            const serviceB = Array(serviceCount).fill({}).map(() => new Service(createIdentifier()));
            const connects = new Set<string>(), closes = new Set<string>();

            //Start
            serviceB.forEach((service, i) => service.start(httpPort + i + 1, scpPort + i + 1, sdpPort, address));
            const connectAB = await Promise.all([on<[Link]>(serviceA, 'connect', serviceCount), ...serviceB.map((service) => on<[Link]>(service, 'connect', serviceCount))]);
            for (const connect of connectAB) {
                for (const [link] of connect) {
                    if (!connects.has(link.scpClient.identifier)) connects.add(link.scpClient.identifier);
                    assert.deepStrictEqual(link.scpClient.connected, true);
                }
            }
            assert.deepStrictEqual(connects.size, 1 + serviceCount); //servicesCount = A + B

            //Stop
            serviceB.forEach((service) => service.stop());
            const closeA = await Promise.all([on<[Link]>(serviceA, 'close', serviceCount)]);
            for (const close of closeA) {
                for (const [link] of close) {
                    if (!closes.has(link.scpClient.identifier)) closes.add(link.scpClient.identifier);
                    assert.deepStrictEqual(link.scpClient.connected, false);
                }
            }
            assert.deepStrictEqual(closes.size, serviceCount); //servicesCount = B

            assert.deepStrictEqual(serviceA.links.size, serviceCount);
            serviceB.forEach((service) => assert.deepStrictEqual(service.links.size, serviceCount));
        });
    });

    mocha.describe('Link Test', () => {
        let serviceA: Service, serviceB: Service;

        const requestHandler = (key: string): RequestHandler => {
            return async (request, response, next) => {
                let body = '';
                for await (const chunk of request) {
                    body += chunk;
                }
                response.writeHead(HttpStatusCode.OK).end(`${body}-${key}`);
            }
        }

        mocha.beforeEach(async () => {
            serviceA = new Service('SVC_A');
            serviceA.link('SVC_B');
            serviceA.link('SVC_C');
            serviceA.proxy('/a/*', 'SVC_B');
            serviceA.proxy('/b/*', 'SVC_C');
            await serviceA.start(httpPort, scpPort, sdpPort, address);

            serviceB = new Service('SVC_B');
            serviceB.link('SVC_A');
            serviceB.post('/b1', requestHandler('b1'));
            serviceB.post('/b2', requestHandler('b2'));
            serviceB.post('/b3', requestHandler('b3'));
            serviceB.reply('B.echo', ((message) => message));
            serviceB.reply('B.spread', ((...message) => message));
            serviceB.reply('B.error', ((message) => { throw new Error(message); }));
            await serviceB.start(httpPort + 1, scpPort + 1, sdpPort, address);

            //Wait for services to be connected to each other.
            await Promise.all([once(serviceA, 'connect'), once(serviceB, 'connect')]);
        });

        mocha.afterEach(async () => {
            await serviceA.stop();
            await serviceB.stop();
        });

        mocha.describe('Proxy Test', () => {
            mocha.it('should proxy a request and its response to the target service', async () => {
                //Client
                const requestBody = createString(1000);
                const { response, body: responseBody } = await clientRequest('POST', serviceA.localAddress, httpPort, '/a/b2', requestBody);
                assert.deepStrictEqual(response.statusCode, HttpStatusCode.OK);
                assert.deepStrictEqual(responseBody, `${requestBody}-b2`);
            });

            mocha.it('should handle proxy request to an unavailable target service', async () => {
                //Client
                const requestBody = createString(1000);
                const { response, body: responseBody } = await clientRequest('POST', serviceA.localAddress, httpPort, '/b/c2', requestBody);
                assert.deepStrictEqual(response.statusCode, HttpStatusCode.SERVICE_UNAVAILABLE);
                assert.deepStrictEqual(responseBody, 'Service is unavailable.');
            });
        });

        mocha.describe('Message/Reply Test', () => {
            const messages = [null, 0, '', {}, [], [null], [0], [''], [{}], [[]], createString(1000), { msg: createString(1000) }, createString(1000).split('')];

            mocha.it('should message(empty) and expect reply(empty)', async () => {
                //Client
                const reply = await serviceA.message('SVC_B', 'B.echo');
                assert.deepStrictEqual(reply, {});
            });

            mocha.it('should message(...object) and expect reply(object)', async () => {
                //Client
                const reply = await serviceA.message('SVC_B', 'B.spread', ...messages);
                assert.deepStrictEqual(reply, messages);
            });

            mocha.it('should message(object) and expect reply(error)', async () => {
                //Client
                try {
                    await serviceA.message('SVC_B', 'B.error', 'SCP Error');
                } catch (error) {
                    assert.deepStrictEqual(error.message, 'SCP Error');
                }
            });

            mocha.it('should message(object) and expect reply(object) in sequence', async () => {
                //Client
                for await (const message of messages) {
                    const reply = await serviceA.message('SVC_B', 'B.echo', message);
                    assert.deepStrictEqual(reply, message);
                }
            });

            mocha.it('should message(object) and expect reply(object) in parallel', async () => {
                //Client
                const reply = await Promise.all(messages.map((message) => serviceA.message('SVC_B', 'B.echo', message)));
                assert.deepStrictEqual(reply, messages);
            });
        });

        mocha.describe('Broadcast Test', () => {
            const broadcasts = [null, 0, '', {}, [], [null], [0], [''], [{}], [[]], createString(1000), { msg: createString(1000) }, createString(1000).split('')];

            mocha.it('should receive broadcast(empty)', (done) => {
                //Server
                serviceA.broadcast('B.broadcast');

                //Client
                serviceB.onBroadcast('SVC_A', 'B.broadcast', (...broadcast) => {
                    assert.deepStrictEqual(broadcast, []);
                    done();
                });
            });

            mocha.it('should receive broadcast(...object)', (done) => {
                //Server
                serviceA.broadcast('B.broadcast', ...broadcasts);

                //Client
                serviceB.onBroadcast('SVC_A', 'B.broadcast', (...broadcast) => {
                    assert.deepStrictEqual(broadcast, broadcasts);
                    done();
                });
            });

            mocha.it('should receive broadcast(object) in sequence', (done) => {
                let broadcastCount = -1;

                //Server
                for (const broadcast of broadcasts) {
                    serviceA.broadcast('B.broadcast', broadcast);
                }

                //Client
                serviceB.onBroadcast('SVC_A', 'B.broadcast', (broadcast) => {
                    broadcastCount++;
                    assert.deepStrictEqual(broadcast, broadcasts[broadcastCount]);
                    if (broadcastCount + 1 === broadcasts.length) done();
                });
            });
        });
    });
});