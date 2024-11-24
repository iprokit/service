// Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';

// Import Local.
import { Server, Attributes } from '../lib/sdp';
import { createIdentifier } from './util';

const port = 5000;
const address = '224.0.0.2';

mocha.describe('SDP Test', () => {
    mocha.describe('Constructor Test', () => {
        mocha.it('should construct server', () => {
            const identifier = createIdentifier();
            const server = new Server(identifier);
            assert.deepStrictEqual(server.identifier, identifier);
        });
    });

    mocha.describe('Connection Test', () => {
        mocha.it('should emit listening & close events', (done) => {
            let listening = 0, close = 0;

            const server = new Server(createIdentifier());
            assert.deepStrictEqual(server.memberships, []);
            assert.deepStrictEqual(server.localAddress, null);
            assert.deepStrictEqual(server.address(), null);
            server.on('listening', () => {
                listening++;
                assert.deepStrictEqual(server.listening, true);
                assert.deepStrictEqual(server.memberships, [address]);
                assert.notDeepStrictEqual(server.localAddress, null);
                assert.deepStrictEqual(server.address()!.port, port);
            });
            server.on('close', () => {
                close++;
                assert.deepStrictEqual(server.listening, false);
                assert.deepStrictEqual(server.memberships, []);
                assert.deepStrictEqual(server.localAddress, null);
                assert.deepStrictEqual(server.address(), null);
            });
            server.listen(port, address, () => {
                server.close(() => { // Calling End
                    assert.deepStrictEqual(listening, close);
                    done();
                });
            });
        });
    });

    mocha.describe('Available/Unavailable Test', () => {
        const on = (server: Server, eventName: string, eventCount: number) => {
            return new Promise<Array<{ identifier: string, attributes: Attributes, host: string }>>((resolve, reject) => {
                const pods = new Array<{ identifier: string, attributes: Attributes, host: string }>();
                const listener = (identifier: string, attributes: Attributes, host: string) => {
                    pods.push({ identifier, attributes, host });
                    if (pods.length === eventCount) {
                        server.off(eventName, listener);
                        resolve(pods);
                    }
                }
                server.on(eventName, listener);
            });
        }

        mocha.it('should emit available & unavailable events', async () => {
            const serverCount = 20;
            const restartCount = 5;
            const identifierB = Array(serverCount).fill({}).map(() => createIdentifier());

            // Start A
            const serverA = new Server(createIdentifier());
            serverA.listen(port, address);
            await once(serverA, 'listening');

            for (let i = 0; i < restartCount; i++) {
                const availables = new Set<string>(), unavailables = new Set<string>();

                // Start B
                const serverB = Array(serverCount).fill({}).map((_, i) => new Server(identifierB[i]));
                serverB.forEach((server) => server.listen(port, address));
                const availableAB = await Promise.all([on(serverA, 'available', serverCount), ...serverB.map((server) => on(server, 'available', serverCount))]);
                for (const available of availableAB) {
                    for (const { identifier, attributes, host } of available) {
                        if (!availables.has(identifier)) availables.add(identifier);
                        assert.deepStrictEqual(attributes, {});
                        assert.notDeepStrictEqual(host, null);
                    }
                }
                assert.deepStrictEqual(availables.size, 1 + serverCount); // serverCount = A + B

                // Stop B
                serverB.forEach((server) => server.close());
                const unavailableA = await Promise.all([on(serverA, 'unavailable', serverCount)]);
                for (const unavailable of unavailableA) {
                    for (const { identifier, attributes, host } of unavailable) {
                        if (!unavailables.has(identifier)) unavailables.add(identifier);
                        assert.deepStrictEqual(attributes, undefined);
                        assert.deepStrictEqual(host, undefined);
                    }
                }
                assert.deepStrictEqual(unavailables.size, serverCount); // serverCount = B

                assert.deepStrictEqual(serverA.pods.size, serverCount);
                serverB.forEach((server) => assert.deepStrictEqual(server.pods.size, serverCount));
            }

            // Stop A
            serverA.close();
            await once(serverA, 'close');
        });
    });
});