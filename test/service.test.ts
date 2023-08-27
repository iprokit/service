//Import Libs.
import mocha from 'mocha';
import assert from 'assert';

//Import Local.
import { Service, Node } from '../lib';
import { createIdentifier } from './util';

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
            assert.deepStrictEqual(service.nodes.length, 0);
            assert.deepStrictEqual(service.routes.length, 0);
            assert.deepStrictEqual(service.remoteFunctions.length, 0);
            done();
        });
    });

    mocha.describe('Start/Stop Test', () => {
        mocha.it('should emit start & stop events multiple times', (done) => {
            const startCount = 10;
            let start = 0, stop = 0;

            const service = new Service(createIdentifier());
            assert.deepStrictEqual(service.listening, { http: false, scp: false, discovery: false });
            assert.deepStrictEqual(service.address(), { http: null, scp: null, discovery: null });
            assert.deepStrictEqual(service.multicastAddress(), null);
            service.on('start', () => {
                start++;
                assert.deepStrictEqual(service.listening, { http: true, scp: true, discovery: true });
                assert.deepStrictEqual(service.address().http.port, httpPort);
                assert.deepStrictEqual(service.address().scp.port, scpPort);
                assert.deepStrictEqual(service.address().discovery.port, discoveryPort);
                assert.deepStrictEqual(service.multicastAddress(), multicastAddress);
                assert.notDeepStrictEqual(service.localAddress(), null);
            });
            service.on('stop', () => {
                stop++;
                assert.deepStrictEqual(service.listening, { http: false, scp: false, discovery: false });
                assert.deepStrictEqual(service.address(), { http: null, scp: null, discovery: null });
                assert.deepStrictEqual(service.multicastAddress(), null);
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

    mocha.describe('Node Test', () => {
        let service: Service;

        mocha.beforeEach(async () => {
            service = new Service(createIdentifier());
            await service.start(httpPort, scpPort, discoveryPort, multicastAddress);
        });

        mocha.afterEach(async () => {
            await service.stop();
        });

        mocha.it('should not create duplicate nodes', (done) => {
            const id1 = createIdentifier(), id2 = createIdentifier(), id3 = createIdentifier();
            service.createNode(id1), service.createNode(id1);
            service.createNode(id2), service.createNode(id2);
            service.createNode(id3), service.createNode(id3), service.createNode(id3);
            assert.deepStrictEqual(service.nodes.length, 3);
            done();
        });

        mocha.it('should emit connect & disconnect events for single node', (done) => {
            let reconnect = -1;

            //Service: 1st
            service.on('connect', async (node: Node) => {
                assert.deepStrictEqual(node.identifier, serviceA.identifier);
                assert.deepStrictEqual(node.connected, true);
                await serviceA.stop(); //Calling End
            });
            service.on('disconnect', async (node: Node) => {
                assert.deepStrictEqual(node.identifier, serviceA.identifier);
                assert.deepStrictEqual(node.connected, false);
                reconnect++;
                if (reconnect === 0) await serviceA.start(3001, 6001, discoveryPort, multicastAddress);
                if (reconnect === 1) done();
            });

            //Service: 2nd
            const serviceA = new Service(createIdentifier());
            serviceA.start(3001, 6001, discoveryPort, multicastAddress);
        });

        mocha.it('should emit connect & disconnect events for multiple nodes', (done) => {
            const nodeCount = 5;
            let c = 0, d = 0;
            const reconnects = Array(nodeCount).fill(-1);

            //Service: 1st
            service.on('connect', async (node: Node) => {
                assert.deepStrictEqual(node.identifier, services[c].identifier);
                assert.deepStrictEqual(node.connected, true);
                await services[c].stop(); //Calling End
                c++;
                if (c === nodeCount) c = 0;
            });
            service.on('disconnect', async (node: Node) => {
                assert.deepStrictEqual(node.identifier, services[d].identifier);
                assert.deepStrictEqual(node.connected, false);
                reconnects[d]++;
                if (reconnects[d] === 0) await services[d].start(httpPort + d + 1, scpPort + d + 1, discoveryPort, multicastAddress);
                if (reconnects[d] === 1 && d + 1 === nodeCount) done();
                d++;
                if (d === nodeCount) d = 0;
            });

            //Service: 2nd
            const services = Array(nodeCount).fill({}).map((_, i) => {
                const service = new Service(createIdentifier());
                service.start(httpPort + i + 1, scpPort + i + 1, discoveryPort, multicastAddress)
                return service;
            });
        });
    });
});