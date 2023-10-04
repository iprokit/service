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
        mocha.it('should emit listening and close events multiple times', (done) => {
            const listeningCount = 10;
            let listening = 0, close = 0;

            const server = new SdpServer(createIdentifier());
            assert.deepStrictEqual(server.multicastAddress, null);
            assert.deepStrictEqual(server.localAddress, null);
            server.on('listening', () => {
                listening++;
                assert.deepStrictEqual(server.listening, true);
                assert.deepStrictEqual(server.multicastAddress, address);
                assert.notDeepStrictEqual(server.localAddress, null);
            });
            server.on('close', () => {
                close++;
                assert.deepStrictEqual(server.listening, false);
                assert.deepStrictEqual(server.multicastAddress, null);
                assert.deepStrictEqual(server.localAddress, null);
            });
            (async () => {
                for (let i = 0; i < listeningCount; i++) {
                    await promisify(server.listen).bind(server)(port, address, {});
                    await promisify(server.close).bind(server)(); //Calling End
                    assert.deepStrictEqual(listening, close);
                }
                done();
            })();
        });
    });

    mocha.describe('Discover/Update Test', () => {
        const serverA = new SdpServer(createIdentifier());

        mocha.beforeEach(async () => {
            serverA.listen(port, address, {});
            await once(serverA, 'listening');
        });

        mocha.afterEach(async () => {
            serverA.close();
            await once(serverA, 'close');
        });

        mocha.it('should emit discover and update events for single pod', async () => {
            const serverB = new SdpServer(createIdentifier());

            serverB.listen(port, address, {});
            const [[discoverA], [discoverB]]: Array<Array<Pod>> = await Promise.all([once(serverA, 'discover'), once(serverB, 'discover')]);
            assert.deepStrictEqual(discoverA.identifier, serverB.identifier);
            assert.deepStrictEqual(discoverB.identifier, serverA.identifier);
            assert.deepStrictEqual(discoverA.available, true);
            assert.deepStrictEqual(discoverB.available, true);
            assert.notDeepStrictEqual(discoverA.attrs, {});
            assert.notDeepStrictEqual(discoverB.attrs, {});
            assert.notDeepStrictEqual(serverA.localAddress, null);
            assert.notDeepStrictEqual(serverB.localAddress, null);
            assert.deepStrictEqual(serverA.listening, true);
            assert.deepStrictEqual(serverB.listening, true);
            assert.deepStrictEqual(serverA.pods.length, 1);
            assert.deepStrictEqual(serverB.pods.length, 1);

            serverB.close(); //Calling End
            const [updateA]: Array<Pod> = await once(serverA, 'update');
            assert.deepStrictEqual(updateA.identifier, serverB.identifier);
            assert.deepStrictEqual(updateA.available, false);
            assert.notDeepStrictEqual(updateA.attrs, {});
            assert.notDeepStrictEqual(serverA.localAddress, null);
            assert.deepStrictEqual(serverB.localAddress, null);
            assert.deepStrictEqual(serverA.listening, true);
            assert.deepStrictEqual(serverB.listening, false);
            assert.deepStrictEqual(serverA.pods.length, 1);
            assert.deepStrictEqual(serverB.pods.length, 1);
        });
    });
});