//Import Libs.
import mocha from 'mocha';
import assert from 'assert';

//Import Local.
import { Service } from '../lib';
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
                start++;
            });
            service.on('stop', () => {
                stop++;
            });

            await service.start(httpPort, scpPort, discoveryPort, discoveryHost, localHost);
            await service.stop(); //Calling End
            assert.deepStrictEqual(start, stop);
        });
    });
});