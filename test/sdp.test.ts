//Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';
import { promisify } from 'util';

//Import Local.
import { Pod, SdpServer } from '../lib';
import { createIdentifier, on } from './util';

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
        let serverA: SdpServer;

        mocha.beforeEach(async () => {
            serverA = new SdpServer(createIdentifier());
            serverA.listen(port, address);
            await once(serverA, 'listening');
        });

        mocha.afterEach(async () => {
            serverA.close();
            await once(serverA, 'close');
        });

        mocha.it('should emit discover and update events for single pod', async () => {
            const serverB = new SdpServer(createIdentifier());
            const discovers = new Set<string>(), updates = new Set<string>();

            //Start
            serverB.listen(port, address);
            const discoverAB = await Promise.all([once(serverA, 'discover'), once(serverB, 'discover')]) as [[Pod], [Pod]];
            for (const [pod] of discoverAB) {
                if (!discovers.has(pod.identifier)) discovers.add(pod.identifier);
                assert.deepStrictEqual(pod.available, true);
                assert.deepStrictEqual(pod.has('host'), true);
                assert.deepStrictEqual(pod.size, 1);
            }
            assert.deepStrictEqual(discovers.size, 1 + 1); //serverCount = A + B

            //Stop
            serverB.close();
            const updateA = await Promise.all([once(serverA, 'update')]) as [[Pod]];
            for (const [pod] of updateA) {
                if (!updates.has(pod.identifier)) updates.add(pod.identifier);
                assert.deepStrictEqual(pod.available, false);
                assert.deepStrictEqual(pod.has('host'), true);
                assert.deepStrictEqual(pod.size, 1);
            }
            assert.deepStrictEqual(updates.size, 1); //serverCount = B

            assert.deepStrictEqual(serverA.pods.size, 1);
            assert.deepStrictEqual(serverB.pods.size, 1);
        });

        mocha.it('should emit discover and update events for multiple pods', async () => {
            const serverCount = 20;
            const serverB = Array(serverCount).fill({}).map(() => new SdpServer(createIdentifier()));
            const discovers = new Set<string>(), updates = new Set<string>();

            //Start
            serverB.forEach((server) => server.listen(port, address));
            const discoverAB = await Promise.all([on<[Pod]>(serverA, 'discover', serverCount), ...serverB.map((server) => on<[Pod]>(server, 'discover', serverCount))]);
            for (const discover of discoverAB) {
                for (const [pod] of discover) {
                    if (!discovers.has(pod.identifier)) discovers.add(pod.identifier);
                    assert.deepStrictEqual(pod.available, true);
                    assert.deepStrictEqual(pod.has('host'), true);
                    assert.deepStrictEqual(pod.size, 1);
                }
            }
            assert.deepStrictEqual(discovers.size, 1 + serverCount); //serverCount = A + B

            //Stop
            serverB.forEach((server) => server.close());
            const updateA = await Promise.all([on<[Pod]>(serverA, 'update', serverCount)]);
            for (const update of updateA) {
                for (const [pod] of update) {
                    if (!updates.has(pod.identifier)) updates.add(pod.identifier);
                    assert.deepStrictEqual(pod.available, false);
                    assert.deepStrictEqual(pod.has('host'), true);
                    assert.deepStrictEqual(pod.size, 1);
                }
            }
            assert.deepStrictEqual(updates.size, serverCount); //serverCount = B

            assert.deepStrictEqual(serverA.pods.size, serverCount);
            serverB.forEach((server) => assert.deepStrictEqual(server.pods.size, serverCount));
        });
    });
});