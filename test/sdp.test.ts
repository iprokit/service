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
            serverA.attrs.set('A', 'a');
            serverA.listen(port, address);
            await once(serverA, 'listening');
        });

        mocha.afterEach(async () => {
            serverA.close();
            await once(serverA, 'close');
        });

        mocha.it('should emit discover and update events for single pod', async () => {
            const serverB = new SdpServer(createIdentifier());
            serverB.attrs.set('B', 'b');

            //Start
            serverB.listen(port, address);
            const [[podA_D], [podB_D]] = await Promise.all([once(serverA, 'discover'), once(serverB, 'discover')]) as [[Pod], [Pod]];
            assert.deepStrictEqual(podA_D.identifier, serverB.identifier);
            assert.deepStrictEqual(podB_D.identifier, serverA.identifier);
            assert.deepStrictEqual(podA_D.available, true);
            assert.deepStrictEqual(podB_D.available, true);
            assert.deepStrictEqual(podA_D.get('host'), serverB.localAddress);
            assert.deepStrictEqual(podB_D.get('host'), serverA.localAddress);
            assert.deepStrictEqual(podA_D.get('B'), 'b');
            assert.deepStrictEqual(podB_D.get('A'), 'a');
            assert.deepStrictEqual(podA_D.size, 2);
            assert.deepStrictEqual(podB_D.size, 2);

            //Stop
            serverB.close();
            const [podA_U] = await once(serverA, 'update') as [Pod];
            assert.deepStrictEqual(podA_U.identifier, serverB.identifier);
            assert.deepStrictEqual(podA_U.available, false);
            assert.deepStrictEqual(podA_U.get('host'), serverB.localAddress);
            assert.deepStrictEqual(podA_U.get('B'), 'b');
            assert.deepStrictEqual(podA_U.size, 2);

            assert.deepStrictEqual(serverA.pods.size, 1);
            assert.deepStrictEqual(serverB.pods.size, 1);
        });

        mocha.it('should emit discover and update events for multiple pods', async () => {
            const serverCount = 20;
            const serverB = Array(serverCount).fill({}).map(() => {
                const server = new SdpServer(createIdentifier());
                server.attrs.set('B', 'b');
                return server;
            });
            let discovers = 0, updates = 0;

            //Start
            serverB.forEach((server) => server.listen(port, address));
            const [discoverA] = await Promise.all([on<[Pod]>(serverA, 'discover', serverCount), ...serverB.map((server) => on<[Pod]>(server, 'discover', serverCount))]);
            for (const [pod] of discoverA) {
                assert.deepStrictEqual(pod.identifier, serverB[discovers].identifier);
                assert.deepStrictEqual(pod.available, true);
                assert.deepStrictEqual(pod.has('host'), true);
                assert.deepStrictEqual(pod.has('B'), true);
                assert.deepStrictEqual(pod.size, 2);
                discovers++;
            }

            //Stop
            serverB.forEach((server) => server.close());
            const updateA = await on<[Pod]>(serverA, 'update', serverCount);
            for (const [pod] of updateA) {
                assert.deepStrictEqual(pod.identifier, serverB[updates].identifier);
                assert.deepStrictEqual(pod.available, false);
                assert.deepStrictEqual(pod.has('host'), true);
                assert.deepStrictEqual(pod.has('B'), true);
                assert.deepStrictEqual(pod.size, 2);
                updates++;
            }

            assert.deepStrictEqual(serverA.pods.size, serverCount);
            serverB.forEach((server) => assert.deepStrictEqual(server.pods.size, serverCount));
        });
    });
});