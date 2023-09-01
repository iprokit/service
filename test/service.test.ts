//Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';

//Import Local.
import { RequestHandler, HttpStatusCode, Service, Link } from '../lib';
import { createString, createIdentifier, createOperation, clientRequest } from './util';

const httpPort = 3000;
const scpPort = 6000;
const discoveryPort = 5000;
const multicastAddress = '224.0.0.1';

mocha.describe('Service Test', () => {
    mocha.describe('Constructor Test', () => {
        mocha.it('should construct service', (done) => {
            const identifier = createIdentifier();
            const service = new Service(identifier);
            assert.deepStrictEqual(service.identifier, identifier);
            assert.deepStrictEqual(service.links.length, 0);
            assert.deepStrictEqual(service.routes.length, 0);
            assert.deepStrictEqual(service.remoteFunctions.length, 0);
            done();
        });
    });

    mocha.describe('Start/Stop Test', () => {
        mocha.it('should emit start & stop events multiple times', (done) => {
            const startCount = 10;
            let start = 0, stop = 0;

            //Service: 1st
            const service = new Service(createIdentifier());
            assert.deepStrictEqual(service.listening, { http: false, scp: false, discovery: false });
            assert.deepStrictEqual(service.address(), { http: null, scp: null, discovery: null });
            assert.deepStrictEqual(service.multicastAddress, null);
            service.on('start', () => {
                start++;
                assert.deepStrictEqual(service.listening, { http: true, scp: true, discovery: true });
                assert.deepStrictEqual(service.address().http.port, httpPort);
                assert.deepStrictEqual(service.address().scp.port, scpPort);
                assert.deepStrictEqual(service.address().discovery.port, discoveryPort);
                assert.deepStrictEqual(service.multicastAddress, multicastAddress);
                assert.notDeepStrictEqual(service.localAddress(), null);
            });
            service.on('stop', () => {
                stop++;
                assert.deepStrictEqual(service.listening, { http: false, scp: false, discovery: false });
                assert.deepStrictEqual(service.address(), { http: null, scp: null, discovery: null });
                assert.deepStrictEqual(service.multicastAddress, null);
            });
            (async () => {
                for (let i = 0; i < startCount; i++) {
                    await service.start(httpPort, scpPort, discoveryPort, multicastAddress);
                    await service.stop(); //Calling End
                    assert.deepStrictEqual(start, stop);
                }
                done();
            })();
        });
    });

    mocha.describe('Connection Test', () => {
        let service: Service;

        mocha.beforeEach(async () => {
            service = new Service(createIdentifier());
            await service.start(httpPort, scpPort, discoveryPort, multicastAddress);
        });

        mocha.afterEach(async () => {
            await service.stop();
        });

        mocha.it('should emit connect & close events for single link', (done) => {
            let reconnect = -1;

            //Service: 1st
            service.on('connect', async (link: Link) => {
                assert.deepStrictEqual(link.identifier, serviceA.identifier);
                assert.deepStrictEqual(link.scpClient.connected, true);
                await serviceA.stop(); //Calling End
            });
            service.on('close', async (link: Link) => {
                assert.deepStrictEqual(link.identifier, serviceA.identifier);
                assert.deepStrictEqual(link.scpClient.connected, false);
                reconnect++;
                if (reconnect === 0) await serviceA.start(3001, 6001, discoveryPort, multicastAddress);
                if (reconnect === 1) done();
            });

            //Service: 2nd
            const serviceA = new Service(createIdentifier());
            serviceA.start(3001, 6001, discoveryPort, multicastAddress);
        });

        mocha.it('should emit connect & close events for multiple links', (done) => {
            const linkCount = 5;
            let c = 0, d = 0;
            const reconnects = Array(linkCount).fill(-1);

            //Service: 1st
            service.on('connect', async (link: Link) => {
                assert.deepStrictEqual(link.identifier, services[c].identifier);
                assert.deepStrictEqual(link.scpClient.connected, true);
                await services[c].stop(); //Calling End
                c++;
                if (c === linkCount) c = 0; //Rest c
            });
            service.on('close', async (link: Link) => {
                assert.deepStrictEqual(link.identifier, services[d].identifier);
                assert.deepStrictEqual(link.scpClient.connected, false);
                reconnects[d]++;
                if (reconnects[d] === 0) await services[d].start(httpPort + d + 1, scpPort + d + 1, discoveryPort, multicastAddress);
                if (reconnects[d] === 1 && d + 1 === linkCount) done();
                d++;
                if (d === linkCount) d = 0; //Rest d
            });

            //Service: 2nd
            const services = Array(linkCount).fill({}).map((_, i) => {
                const service = new Service(createIdentifier());
                service.start(httpPort + i + 1, scpPort + i + 1, discoveryPort, multicastAddress)
                return service;
            });
        });
    });

    mocha.describe('Link Test', () => {
        let serviceA: Service, serviceB: Service;

        const requestHandler = (body: string): RequestHandler => {
            return (request, response, next) => {
                response.writeHead(HttpStatusCode.OK).end(body);
            }
        }

        const echoOperation = createOperation(), spreadOperation = createOperation(), errorOperation = createOperation(), broadcastOperation = createOperation();
        const data = [null, 0, '', {}, [], [null], [0], [''], [{}], [[]], createString(1000), { msg: createString(1000) }, createString(1000).split('')];

        mocha.beforeEach(async () => {
            serviceA = new Service('SVC_A');
            serviceA.link('SVC_B');
            serviceA.proxy('/a/*', 'SVC_B');
            await serviceA.start(httpPort, scpPort, discoveryPort, multicastAddress);

            serviceB = new Service('SVC_B');
            serviceB.link('SVC_A');
            serviceB.get('/b1', requestHandler('b1'));
            serviceB.get('/b2', requestHandler('b2'));
            serviceB.get('/b3', requestHandler('b3'));
            serviceB.reply(echoOperation, ((message) => message));
            serviceB.reply(spreadOperation, ((...message) => message));
            serviceB.reply(errorOperation, ((message) => { throw new Error(message); }));
            await serviceB.start(httpPort + 1, scpPort + 1, discoveryPort, multicastAddress);

            //Wait for services to be connected to each other.
            await Promise.all([await once(serviceA, 'connect'), await once(serviceB, 'connect')]);
        });

        mocha.afterEach(async () => {
            await serviceA.stop();
            await serviceB.stop();
        });

        mocha.it('should proxy request & response', async () => {
            //Service: 1st
            const { response, body } = await clientRequest('GET', serviceA.localAddress(), httpPort, '/a/b2', '');
            assert.deepStrictEqual(response.statusCode, HttpStatusCode.OK);
            assert.deepStrictEqual(body, 'b2');
        });

        mocha.it('should message(empty) and expect reply(empty)', async () => {
            //Service: 1st
            const reply = await serviceA.message('SVC_B', echoOperation);
            assert.deepStrictEqual(reply, {});
        });

        mocha.it('should message(...object) and expect reply(object)', async () => {
            //Service: 1st
            const reply = await serviceA.message('SVC_B', spreadOperation, ...data);
            assert.deepStrictEqual(reply, data);
        });

        mocha.it('should message(object) and expect reply(error)', async () => {
            //Service: 1st
            try {
                await serviceA.message('SVC_B', errorOperation, 'SCP Error');
            } catch (error) {
                assert.deepStrictEqual(error.message, 'SCP Error');
            }
        });

        mocha.it('should message(object) and expect reply(object) in sequence', async () => {
            //Service: 1st
            for await (const datum of data) {
                const reply = await serviceA.message('SVC_B', echoOperation, datum);
                assert.deepStrictEqual(reply, datum);
            }
        });

        mocha.it('should message(object) and expect reply(object) in parallel', async () => {
            //Service: 1st
            const reply = await Promise.all(data.map(async (datum) => await serviceA.message('SVC_B', echoOperation, datum)));
            assert.deepStrictEqual(reply, data);
        });

        mocha.it('should receive broadcast(empty)', (done) => {
            //Service: 1st
            serviceA.broadcast(broadcastOperation);

            //Service: 2nd
            serviceB.onBroadcast('SVC_A', broadcastOperation, (...broadcast) => {
                assert.deepStrictEqual(broadcast, []);
                done();
            });
        });

        mocha.it('should receive broadcast(...object)', (done) => {
            //Service: 1st
            serviceA.broadcast(broadcastOperation, ...data);

            //Service: 2nd
            serviceB.onBroadcast('SVC_A', broadcastOperation, (...broadcast) => {
                assert.deepStrictEqual(broadcast, data);
                done();
            });
        });

        mocha.it('should receive broadcast(object) in sequence', (done) => {
            let broadcasts = -1;

            //Service: 1st
            for (const datum of data) {
                serviceA.broadcast(broadcastOperation, datum);
            }

            //Service: 2nd
            serviceB.onBroadcast('SVC_A', broadcastOperation, (broadcast) => {
                broadcasts++;
                assert.deepStrictEqual(broadcast, data[broadcasts]);
                if (broadcasts + 1 === data.length) done();
            });
        });
    });
});