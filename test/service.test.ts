//Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';

//Import Local.
import { RequestHandler, HttpStatusCode, Service } from '../lib';
import { createString, createIdentifier, clientRequest } from './util';

const http = 3000;
const scp = 6000;
const sdp = 5000;
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

    mocha.describe('Connection Test', () => {
        mocha.it('should emit start & stop events for single instance', async () => {
            let start = 0, stop = 0;

            const service = new Service(createIdentifier());
            assert.deepStrictEqual(service.listening, { http: false, scp: false, sdp: false });
            assert.deepStrictEqual(service.address(), { http: null, scp: null, sdp: null });
            assert.deepStrictEqual(service.memberships.size, 0);
            assert.deepStrictEqual(service.localAddress, null);
            service.on('start', () => {
                start++;
                assert.deepStrictEqual(service.listening, { http: true, scp: true, sdp: true });
                assert.deepStrictEqual(service.address().http.port, http);
                assert.deepStrictEqual(service.address().scp.port, scp);
                assert.deepStrictEqual(service.address().sdp.port, sdp);
                assert.deepStrictEqual(service.memberships.has(address), true);
                assert.notDeepStrictEqual(service.localAddress, null);
            });
            service.on('stop', () => {
                stop++;
                assert.deepStrictEqual(service.listening, { http: false, scp: false, sdp: false });
                assert.deepStrictEqual(service.address(), { http: null, scp: null, sdp: null });
                assert.deepStrictEqual(service.memberships.size, 0);
                assert.deepStrictEqual(service.localAddress, null);
            });
            await service.start(http, scp, sdp, address);
            await service.stop(); //Calling End
            assert.deepStrictEqual(start, stop);
        });

        mocha.it('should emit start & stop events for multiple instances', async () => {
            const serviceCount = 40;
            const identifiers = Array(serviceCount).fill({}).map(() => createIdentifier());

            //Initialize
            const services = Array(serviceCount).fill({}).map((_, i) => new Service(identifiers[i]).link(...identifiers.filter((_, j) => i !== j)));
            for (const service of services) {
                assert.deepStrictEqual(service.listening, { http: false, scp: false, sdp: false });
                assert.deepStrictEqual(service.links.size, serviceCount - 1);
                service.links.forEach((link) => {
                    assert.deepStrictEqual(link.scpClient.connected, false);
                    assert.deepStrictEqual(link.proxyOptions, { host: undefined, port: undefined });
                });
            }

            //Start
            services.forEach((service, i) => service.start(http + i, scp + i, sdp, address));
            await Promise.all([...services.map((service) => once(service, 'start'))]);
            for (const service of services) {
                assert.deepStrictEqual(service.listening, { http: true, scp: true, sdp: true });
                assert.deepStrictEqual(service.links.size, serviceCount - 1);
                service.links.forEach((link) => {
                    assert.deepStrictEqual(link.scpClient.connected, true);
                    assert.notDeepStrictEqual(link.proxyOptions, { host: undefined, port: undefined });
                });
            }

            //Stop
            services.forEach((service, i) => service.stop());
            await Promise.all([...services.map((service) => once(service, 'stop'))]);
            for (const service of services) {
                assert.deepStrictEqual(service.listening, { http: false, scp: false, sdp: false });
                assert.deepStrictEqual(service.links.size, serviceCount - 1);
                service.links.forEach((link) => {
                    assert.deepStrictEqual(link.scpClient.connected, false);
                    assert.deepStrictEqual(link.proxyOptions, { host: undefined, port: undefined });
                });
            }
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
            serviceA.proxy('/a/*', 'SVC_B');

            serviceB = new Service('SVC_B');
            serviceB.link('SVC_A');
            serviceB.post('/b1', requestHandler('b1'));
            serviceB.post('/b2', requestHandler('b2'));
            serviceB.post('/b3', requestHandler('b3'));
            serviceB.reply('B.echo', ((message) => message));
            serviceB.reply('B.spread', ((...message) => message));
            serviceB.reply('B.error', ((message) => { throw new Error(message); }));

            await Promise.all([serviceA.start(http, scp, sdp, address), serviceB.start(http + 1, scp + 1, sdp, address)]);
        });

        mocha.afterEach(async () => {
            await Promise.all([serviceA.stop(), serviceB.stop()]);
        });

        mocha.describe('Proxy Test', () => {
            mocha.it('should proxy a request & response to the target service', async () => {
                //Client
                const requestBody = createString(1000);
                const { response, body: responseBody } = await clientRequest('POST', serviceA.localAddress, http, '/a/b2', requestBody);
                assert.deepStrictEqual(response.statusCode, HttpStatusCode.OK);
                assert.deepStrictEqual(responseBody, `${requestBody}-b2`);
            });

            mocha.it('should handle proxy request to an unavailable target service', async () => {
                //Server
                serviceA.link('SVC_C');
                serviceA.proxy('/b/*', 'SVC_C');

                //Client
                const requestBody = createString(1000);
                const { response, body: responseBody } = await clientRequest('POST', serviceA.localAddress, http, '/b/c2', requestBody);
                assert.deepStrictEqual(response.statusCode, HttpStatusCode.INTERNAL_SERVER_ERROR);
                assert.deepStrictEqual(responseBody.includes('ECONNREFUSED'), true);
            });
        });

        mocha.describe('Message/Reply Test', () => {
            const messages = [null, 0, '', {}, [], [null], [0], [''], [{}], [[]], createString(1000), { msg: createString(1000) }, createString(1000).split('')];

            mocha.it('should message(empty) & expect reply(empty)', async () => {
                //Client
                const reply = await serviceA.message('SVC_B', 'B.echo');
                assert.deepStrictEqual(reply, {});
            });

            mocha.it('should message(...object) & expect reply(object)', async () => {
                //Client
                const reply = await serviceA.message('SVC_B', 'B.spread', ...messages);
                assert.deepStrictEqual(reply, messages);
            });

            mocha.it('should message(object) & expect reply(error)', async () => {
                //Client
                try {
                    await serviceA.message('SVC_B', 'B.error', 'SCP Error');
                } catch (error) {
                    assert.deepStrictEqual(error.message, 'SCP Error');
                }
            });

            mocha.it('should message(object) & expect reply(object) in sequence', async () => {
                //Client
                for await (const message of messages) {
                    const reply = await serviceA.message('SVC_B', 'B.echo', message);
                    assert.deepStrictEqual(reply, message);
                }
            });

            mocha.it('should message(object) & expect reply(object) in parallel', async () => {
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