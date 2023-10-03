//Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';
import { promisify } from 'util';

//Import Local.
import { Pod, SdpServer } from '../lib';
import { createIdentifier } from './util';

const address = '224.0.0.1';
const port = 5000;

mocha.describe('SDP Test', () => {
    mocha.describe('Constructor Test', () => {
        mocha.it('should construct server', (done) => {
            const identifier = createIdentifier();
            const server = new SdpServer(identifier);
            assert.deepStrictEqual(server.identifier, identifier);
            done();
        });
    });

    mocha.describe('Connection Test', () => {
        mocha.it('should emit listening and close events', (done) => {
            let listening = 0, close = 0;

            const server = new SdpServer(createIdentifier());
            assert.deepStrictEqual(server.multicastAddress, null);
            assert.deepStrictEqual(server.localAddress, null);
            server.on('listening', () => {
                listening++;
                assert.deepStrictEqual(server.listening, true);
                assert.deepStrictEqual(server.multicastAddress, address);
                assert.deepStrictEqual(server.localAddress, null);
            });
            server.on('close', () => {
                close++;
                assert.deepStrictEqual(server.listening, false);
                assert.deepStrictEqual(server.multicastAddress, null);
                assert.deepStrictEqual(server.localAddress, null);
            });
            (async () => {
                await promisify(server.listen).bind(server)(port, address, {});
                await promisify(server.close).bind(server)(); //Calling End
                assert.deepStrictEqual(listening, close);
                done();
            })();
        });
    });

    mocha.describe('Discover/Update Test', () => {
        const server = new SdpServer(createIdentifier());

        mocha.beforeEach(async () => {
            server.listen(port, address, {});
            await once(server, 'listening');
        });

        mocha.afterEach(async () => {
            server.close();
            await once(server, 'close');
        });

        mocha.it('should emit discover and update events for single pod', async () => {
            const serverA = new SdpServer(createIdentifier());
            serverA.listen(port, address, {});

            const [[podDiscoverA], [podDiscoverB]]: Array<Array<Pod>> = await Promise.all([await once(server, 'discover'), await once(serverA, 'discover')]);
            assert.deepStrictEqual(podDiscoverA.identifier, serverA.identifier);
            assert.deepStrictEqual(podDiscoverB.identifier, server.identifier);
            assert.deepStrictEqual(podDiscoverA.available, true);
            assert.deepStrictEqual(podDiscoverB.available, true);
            assert.deepStrictEqual(podDiscoverA.attrs, { address: serverA.localAddress });
            assert.deepStrictEqual(podDiscoverB.attrs, { address: server.localAddress });
            assert.deepStrictEqual(server.listening, true);
            assert.deepStrictEqual(serverA.listening, true);
            assert.deepStrictEqual(server.pods.length, 1);
            assert.deepStrictEqual(serverA.pods.length, 1);
            serverA.close(); //Calling End

            const [podUpdate]: Array<Pod> = await once(server, 'update');
            assert.deepStrictEqual(podUpdate.identifier, serverA.identifier);
            assert.deepStrictEqual(podUpdate.available, false);
            assert.deepStrictEqual(podUpdate.attrs, { address: serverA.localAddress });
            assert.deepStrictEqual(server.listening, true);
            assert.deepStrictEqual(serverA.listening, false);
            assert.deepStrictEqual(server.pods.length, 1);
            assert.deepStrictEqual(serverA.pods.length, 1);
        });
    });
});