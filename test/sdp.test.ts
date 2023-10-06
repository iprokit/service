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
            assert.deepStrictEqual(server.memberships, null);
            assert.deepStrictEqual(server.localAddress, null);
            assert.deepStrictEqual(server.address(), null);
            server.on('listening', () => {
                listening++;
                assert.deepStrictEqual(server.listening, true);
                assert.deepStrictEqual(server.memberships, [address]);
                assert.notDeepStrictEqual(server.localAddress, null);
                assert.deepStrictEqual(server.address().port, port);
            });
            server.on('close', () => {
                close++;
                assert.deepStrictEqual(server.listening, false);
                assert.deepStrictEqual(server.memberships, []);
                assert.deepStrictEqual(server.localAddress, null);
                assert.deepStrictEqual(server.address(), null);
            });
            (async () => {
                for (let i = 0; i < listeningCount; i++) {
                    await promisify(server.listen).bind(server)(port, address);
                    await promisify(server.close).bind(server)(); //Calling End
                    assert.deepStrictEqual(listening, close);
                }
                done();
            })();
        });
    });

    mocha.describe('Discover/Update Test', () => {
        mocha.it('should emit discover and update events for single pod', async () => {
            const serverA = new SdpServer(createIdentifier());
            serverA.attrs.set('A', 'a');
            const serverB = new SdpServer(createIdentifier());
            serverB.attrs.set('B', 'b');
            await promisify(serverA.listen).bind(serverA)(port, address);

            serverB.listen(port, address);
            const [[discoverA], [discoverB]]: Array<Array<Pod>> = await Promise.all([once(serverA, 'discover'), once(serverB, 'discover')]);
            assert.deepStrictEqual(discoverA.identifier, serverB.identifier);
            assert.deepStrictEqual(discoverB.identifier, serverA.identifier);
            assert.deepStrictEqual(discoverA.available, true);
            assert.deepStrictEqual(discoverB.available, true);
            assert.deepStrictEqual(discoverA.get('host'), serverB.localAddress);
            assert.deepStrictEqual(discoverB.get('host'), serverA.localAddress);
            assert.deepStrictEqual(discoverA.get('B'), 'b');
            assert.deepStrictEqual(discoverB.get('A'), 'a');
            assert.deepStrictEqual(discoverA.size, 2);
            assert.deepStrictEqual(discoverB.size, 2);

            serverB.close(); //Calling End
            const [updateA] = await once(serverA, 'update') as [Pod];
            assert.deepStrictEqual(updateA.identifier, serverB.identifier);
            assert.deepStrictEqual(updateA.available, false);
            assert.deepStrictEqual(updateA.get('host'), serverB.localAddress);
            assert.deepStrictEqual(updateA.get('B'), 'b');
            assert.deepStrictEqual(updateA.size, 2);

            await promisify(serverA.close).bind(serverA)();
            assert.deepStrictEqual(serverA.pods.size, 1);
            assert.deepStrictEqual(serverB.pods.size, 1);
        });

        mocha.it('should emit discover and update events for multiple pods', async () => {
            const serverCount = 20;
            const serverA = new SdpServer(createIdentifier());
            const serverB = Array(serverCount).fill({}).map(() => {
                const server = new SdpServer(createIdentifier());
                server.attrs.set('B', 'b');
                return server;
            });
            let discovers = 0, updates = 0;

            await promisify(serverA.listen).bind(serverA)(port, address);

            serverB.forEach((server) => server.listen(port, address));
            for await (const [discover] of (on(serverA, 'discover') as AsyncIterableIterator<[Pod]>)) {
                assert.deepStrictEqual(discover.identifier, serverB[discovers].identifier);
                assert.deepStrictEqual(discover.available, true);
                assert.deepStrictEqual(discover.has('host'), true);
                assert.deepStrictEqual(discover.has('B'), true);
                assert.deepStrictEqual(discover.size, 2);
                discovers++;
                if (discovers === serverCount) break;
            }

            serverB.forEach((server) => server.close()); //Calling End
            for await (const [update] of (on(serverA, 'update') as AsyncIterableIterator<[Pod]>)) {
                assert.deepStrictEqual(update.identifier, serverB[updates].identifier);
                assert.deepStrictEqual(update.available, false);
                assert.deepStrictEqual(update.has('host'), true);
                assert.deepStrictEqual(update.has('B'), true);
                assert.deepStrictEqual(update.size, 2);
                updates++;
                if (updates === serverCount) break;
            }

            await promisify(serverA.close).bind(serverA)();
            assert.deepStrictEqual(serverA.pods.size, serverCount);
        });
    });
});