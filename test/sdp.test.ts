//Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { on, once } from 'events';
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
            const listeningCount = 20;
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
        mocha.it('should emit discover and update events for single pod', async () => {
            const serverA = new SdpServer(createIdentifier()), serverB = new SdpServer(createIdentifier());
            await promisify(serverA.listen).bind(serverA)(port, address, {});

            serverB.listen(port, address, {});
            const [[discoverA], [discoverB]]: Array<Array<Pod>> = await Promise.all([once(serverA, 'discover'), once(serverB, 'discover')]);
            assert.deepStrictEqual(discoverA.identifier, serverB.identifier);
            assert.deepStrictEqual(discoverB.identifier, serverA.identifier);
            assert.deepStrictEqual(discoverA.available, true);
            assert.deepStrictEqual(discoverB.available, true);
            assert.notDeepStrictEqual(discoverA.attrs, {});
            assert.notDeepStrictEqual(discoverB.attrs, {});

            serverB.close(); //Calling End
            const [updateA]: Array<Pod> = await once(serverA, 'update');
            assert.deepStrictEqual(updateA.identifier, serverB.identifier);
            assert.deepStrictEqual(updateA.available, false);
            assert.notDeepStrictEqual(updateA.attrs, {});

            await promisify(serverA.close).bind(serverA)();
        });

        mocha.it('should emit discover and update events for multiple pods', async () => {
            const serverA = new SdpServer(createIdentifier()), serverB = Array(5).fill({}).map(() => new SdpServer(createIdentifier()));
            let discoveries = 0, updates = 0;

            await promisify(serverA.listen).bind(serverA)(port, address, {});

            serverB.forEach((server) => server.listen(port, address, {}));
            for await (const [discover] of on(serverA, 'discover')) {
                assert.deepStrictEqual(discover.identifier, serverB[discoveries].identifier);
                assert.deepStrictEqual(discover.available, true);
                assert.notDeepStrictEqual(discover.attrs, {});
                discoveries++;
                if (discoveries === serverB.length - 1) break;
            }

            serverB.forEach((server) => server.close()); //Calling End
            for await (const [update] of on(serverA, 'update')) {
                assert.deepStrictEqual(update.identifier, serverB[updates].identifier);
                assert.deepStrictEqual(update.available, false);
                assert.notDeepStrictEqual(update.attrs, {});
                updates++;
                if (updates === serverB.length - 1) break;
            }

            await promisify(serverA.close).bind(serverA)();
        });
    });
});