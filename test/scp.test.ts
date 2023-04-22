//Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';

//Import Local.
import { Server, Client, remoteReply, remoteBroadcast } from '../lib';
import { createIdentifier, createMap, createBody } from './util';

const host = '127.0.0.1';
const port = 6000;

mocha.describe('SCP Test', () => {
    mocha.describe('Constructor Test', () => {
        mocha.it('should construct server', (done) => {
            const server = new Server();
            assert.deepStrictEqual(server.remoteFunctions.length, 1);
            done();
        });

        mocha.it('should construct client', (done) => {
            const identifier = createIdentifier();
            const client = new Client(identifier);
            assert.deepStrictEqual(client.identifier, identifier);
            done();
        });
    });

    mocha.describe('Subscription Test', () => {
        let server: Server;
        let client: Client;

        mocha.afterEach(async () => {
            client.close();
            await once(client, 'close');
            server.close();
            await once(server, 'close');
        });

        mocha.it('should subscribe on connect event', async () => {
            //Server
            server = new Server();
            server.listen(port);
            await once(server, 'listening');

            //Client
            const identifier = createIdentifier();
            client = new Client(identifier);
            client.connect(port, host);
            await once(client, 'connect');

            assert.deepStrictEqual((server as any)._connections[0].canBroadcast, true);
            assert.deepStrictEqual((server as any)._connections[0].identifier, identifier);
        });
    });

    mocha.describe('Remote Function Test', () => {
        let server: Server;
        let client: Client;

        const echoReplyMap = createMap(), spreadReplyMap = createMap(), errorReplyMap = createMap();
        const broadcastMap = createMap();
        const payloads = [null, 0, '', {}, [], [null], [0], [''], [{}], [[]], createBody(1000), { msg: createBody(1000) }, createBody(1000).split('')];

        mocha.beforeEach(async () => {
            server = new Server();
            server.listen(port);
            server.reply(echoReplyMap, remoteReply((arg) => { return arg; }));
            server.reply(spreadReplyMap, remoteReply((arg1, arg2, arg3, arg4, arg5) => { return [arg1, arg2, arg3, arg4, arg5]; }));
            server.reply(errorReplyMap, remoteReply((arg) => { throw new Error('SCP error'); }));
            server.registerBroadcast(broadcastMap, remoteBroadcast());
            await once(server, 'listening');

            client = new Client(createIdentifier());
            client.connect(port, host);
            await once(client, 'connect');
        });

        mocha.afterEach(async () => {
            client.close();
            await once(client, 'close');
            server.close();
            await once(server, 'close');
        });

        mocha.it('should message and expect reply', async () => {
            //Empty
            const reply1 = await client.message(echoReplyMap);
            assert.deepStrictEqual(reply1, {});

            //Sequence
            for (const message of payloads) {
                const reply2 = await client.message(echoReplyMap, message);
                assert.deepStrictEqual(reply2, message);
            }

            //Parallel
            const reply3 = await Promise.all(payloads.map((message) => client.message(echoReplyMap, message)));
            assert.deepStrictEqual(reply3, payloads);

            //Spread
            const reply4 = await client.message(spreadReplyMap, payloads[0], payloads[1], payloads[2], payloads[3], payloads[4]);
            assert.deepStrictEqual(reply4, [payloads[0], payloads[1], payloads[2], payloads[3], payloads[4]]);

            //Error
            try {
                await client.message(errorReplyMap);
            } catch (error) {
                assert.deepStrictEqual(error.message, 'SCP error');
            }
        });

        mocha.it('should receive broadcast', async () => {
            //Empty
            server.broadcast(broadcastMap);
            const broadcast1 = await once(client, broadcastMap);
            assert.deepStrictEqual(broadcast1, []);

            //Sequence
            for (const broadcast of payloads) {
                server.broadcast(broadcastMap, broadcast);
                const broadcast2 = await once(client, broadcastMap);
                assert.deepStrictEqual(broadcast2[0], broadcast)
            }

            //Spread
            server.broadcast(broadcastMap, payloads[0], payloads[1], payloads[2], payloads[3], payloads[4]);
            const broadcast3 = await once(client, broadcastMap);
            assert.deepStrictEqual(broadcast3, [payloads[0], payloads[1], payloads[2], payloads[3], payloads[4]]);
        });
    });
});