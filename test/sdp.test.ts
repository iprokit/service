//Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';

//Import Local.
import { Pod, SdpServer } from '../lib';
import { createIdentifier } from './util';

const port = 5000;
const address = '224.0.0.1';

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
        mocha.it('should emit listening & close events', (done) => {
            let listening = 0, close = 0;

            const server = new SdpServer(createIdentifier());
            assert.deepStrictEqual(server.memberships.size, 0);
            assert.deepStrictEqual(server.localAddress, null);
            assert.deepStrictEqual(server.address(), null);
            server.on('listening', () => {
                listening++;
                assert.deepStrictEqual(server.listening, true);
                assert.deepStrictEqual(server.memberships.has(address), true);
                assert.notDeepStrictEqual(server.localAddress, null);
                assert.deepStrictEqual(server.address().port, port);
            });
            server.on('close', () => {
                close++;
                assert.deepStrictEqual(server.listening, false);
                assert.deepStrictEqual(server.memberships.size, 0);
                assert.deepStrictEqual(server.localAddress, null);
                assert.deepStrictEqual(server.address(), null);
            });
            server.listen(port, address, () => {
                server.close(() => { //Calling End
                    assert.deepStrictEqual(listening, close);
                    done();
                });
            });
        });
    });

    mocha.describe('Available/Unavailable Test', () => {
        let serverA: SdpServer;

        const on = (server: SdpServer, eventName: string, eventCount: number) => {
            return new Promise<Array<Pod>>((resolve, reject) => {
                const pods = new Array<Pod>();
                const listener = (pod: Pod) => {
                    pods.push(pod);
                    if (pods.length === eventCount) {
                        server.removeListener(eventName, listener);
                        resolve(pods);
                    }
                };
                server.on(eventName, listener);
            });
        }

        mocha.beforeEach(async () => {
            serverA = new SdpServer(createIdentifier());
            serverA.listen(port, address);
            await once(serverA, 'listening');
        });

        mocha.afterEach(async () => {
            serverA.close();
            await once(serverA, 'close');
        });

        mocha.it('should emit available & unavailable events for multiple instances', async () => {
            const restartCount = 5;
            const serverCount = 20
            const identifierB = Array(serverCount).fill({}).map(() => createIdentifier());

            for (let i = 0; i < restartCount; i++) {
                const serverB = Array(serverCount).fill({}).map((_, i) => new SdpServer(identifierB[i]));
                const availables = new Set<string>(), unavailables = new Set<string>();

                //Start
                serverB.forEach((server) => server.listen(port, address));
                const availableAB = await Promise.all([on(serverA, 'available', serverCount), ...serverB.map((server) => on(server, 'available', serverCount))]);
                for (const available of availableAB) {
                    for (const pod of available) {
                        if (!availables.has(pod.identifier)) availables.add(pod.identifier);
                        assert.deepStrictEqual(pod.available, true);
                        assert.deepStrictEqual(pod.has('host'), true);
                        assert.deepStrictEqual(pod.size, 1);
                    }
                }
                assert.deepStrictEqual(availables.size, 1 + serverCount); //serverCount = A + B

                //Stop
                serverB.forEach((server) => server.close());
                const unavailableA = await Promise.all([on(serverA, 'unavailable', serverCount)]);
                for (const unavailable of unavailableA) {
                    for (const pod of unavailable) {
                        if (!unavailables.has(pod.identifier)) unavailables.add(pod.identifier);
                        assert.deepStrictEqual(pod.available, false);
                        assert.deepStrictEqual(pod.has('host'), true);
                        assert.deepStrictEqual(pod.size, 1);
                    }
                }
                assert.deepStrictEqual(unavailables.size, serverCount); //serverCount = B

                assert.deepStrictEqual(serverA.pods.size, serverCount);
                serverB.forEach((server) => assert.deepStrictEqual(server.pods.size, serverCount));
            }
        });
    });
});