//Import Libs.
import mocha from 'mocha';
import assert from 'assert';

//Import Local.
import { Service, Node } from '../lib';
import { createIdentifier } from './util';

const httpPort = 3000;
const scpPort = 6000;
const discoveryPort = 5000;
const discoveryHost = '224.0.0.1';

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
        mocha.it('should emit start & stop events', async () => {
            let start = 0, stop = 0;

            const service = new Service(createIdentifier());
            service.on('start', () => {
                assert.deepStrictEqual(service.listening, { http: true, scp: true, discovery: true });
                start++;
            });
            service.on('stop', () => {
                assert.deepStrictEqual(service.listening, { http: false, scp: false, discovery: false });
                stop++;
            });

            await service.start(httpPort, scpPort, discoveryPort, discoveryHost);
            await service.stop(); //Calling End
            assert.deepStrictEqual(start, stop);
        });
    });

    mocha.describe('Node Test', () => {
        let service: Service;

        mocha.beforeEach(async () => {
            service = new Service(createIdentifier());
            await service.start(httpPort, scpPort, discoveryPort, discoveryHost);
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

        mocha.it('should emit node event for single service', (done) => {
            //Service: 1st
            service.on('node', async (node: Node) => {
                assert.deepStrictEqual(node.identifier, serviceA.identifier);
                assert.deepStrictEqual(node.connected, true);
                await serviceA.stop(); //Calling End
                done();
            });

            //Service: 2nd
            const serviceA = new Service(createIdentifier());
            serviceA.start(3001, 6001, discoveryPort, discoveryHost);
        });

        mocha.it('should emit node event for multiple services', (done) => {
            let nodes = 0;

            //Service: 1st
            service.on('node', async (node: Node) => {
                assert.deepStrictEqual(node.identifier, services[nodes].identifier);
                assert.deepStrictEqual(node.connected, true);
                if (nodes === services.length - 1) {
                    await Promise.all(services.map(async (service) => await service.stop())); //Calling End
                    done();
                }
                nodes++;
            });

            //Service: 2nd
            const services = new Array<Service>();
            for (let i = 0; i < 10; i++) {
                const service = new Service(createIdentifier());
                service.start(httpPort + i + 1, scpPort + i + 1, discoveryPort, discoveryHost);
                services.push(service);
            }
        });
    });
});