//Import Libs.
import mocha from 'mocha';
import assert from 'assert';

//Import Local.
import { Service, RemoteService } from '../lib';
import { createIdentifier } from './util';

const httpPort = 3000;
const scpPort = 6000;
const discoveryPort = 5000;
const discoveryHost = '224.0.0.1';
const localHost = '127.0.0.1';

mocha.describe('Service Test', () => {
    mocha.describe('Constructor Test', () => {
        mocha.it('should construct service', (done) => {
            const identifier = createIdentifier();
            const service = new Service(identifier);
            assert.deepStrictEqual(service.identifier, identifier);
            done();
        });
    });

    mocha.describe('Start/Stop Test', () => {
        mocha.it('should emit start & stop events', async () => {
            let start = 0, stop = 0;

            const service = new Service(createIdentifier());
            service.on('start', () => {
                assert.deepStrictEqual(service.httpServer.listening, true);
                assert.deepStrictEqual(service.scpServer.listening, true);
                assert.deepStrictEqual(service.discovery.listening, true);
                start++;
            });
            service.on('stop', () => {
                assert.deepStrictEqual(service.httpServer.listening, false);
                assert.deepStrictEqual(service.scpServer.listening, false);
                assert.deepStrictEqual(service.discovery.listening, false);
                stop++;
            });

            await service.start(httpPort, scpPort, discoveryPort, discoveryHost, localHost);
            await service.stop(); //Calling End
            assert.deepStrictEqual(start, stop);
        });
    });

    mocha.describe('Remote Service Test', () => {
        let service: Service;

        mocha.beforeEach(async () => {
            service = new Service(createIdentifier());
            await service.start(httpPort, scpPort, discoveryPort, discoveryHost, localHost);
        });

        mocha.afterEach(async () => {
            await service.stop();
        });

        mocha.it('should emit remoteService event for single service', (done) => {
            //Service: 1st
            service.on('remoteService', async (remoteService: RemoteService) => {
                assert.deepStrictEqual(remoteService.identifier, serviceA.identifier);
                await serviceA.stop(); //Calling End
                done();
            });

            //Service: 2nd
            const serviceA = new Service(createIdentifier());
            serviceA.start(3001, 6001, discoveryPort, discoveryHost, localHost);
        });

        mocha.it('should emit remoteService event for multiple services', (done) => {
            let remoteServices = 0;

            //Service: 1st
            service.on('remoteService', async (remoteService: RemoteService) => {
                assert.deepStrictEqual(remoteService.identifier, services[remoteServices].identifier);
                if (remoteServices === services.length - 1) {
                    await Promise.all(services.map(async (service) => await service.stop())); //Calling End
                    done();
                }
                remoteServices++;
            });

            //Service: 2nd
            const services = new Array<Service>();
            for (let i = 0; i < 10; i++) {
                const service = new Service(createIdentifier());
                service.start(httpPort + i + 1, scpPort + i + 1, discoveryPort, discoveryHost, localHost);
                services.push(service);
            }
        });
    });
});