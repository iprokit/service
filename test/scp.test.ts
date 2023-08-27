//Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';
import { promisify } from 'util';

//Import Local.
import { Args, Incoming, Outgoing, ScpClient, ScpServer, NextFunction } from '../lib';
import { createIdentifier, createMap, createBody } from './util';

const host = '127.0.0.1';
const port = 6000;

mocha.describe('SCP Test', () => {
    mocha.describe('Constructor Test', () => {
        mocha.it('should construct server', (done) => {
            const identifier = createIdentifier();
            const server = new ScpServer(identifier);
            assert.deepStrictEqual(server.identifier, identifier);
            done();
        });

        mocha.it('should construct client', (done) => {
            const identifier = createIdentifier();
            const client = new ScpClient(identifier);
            assert.deepStrictEqual(client.identifier, identifier);
            done();
        });
    });

    mocha.describe('Connection Test', () => {
        let server: ScpServer;

        mocha.beforeEach(async () => {
            server = new ScpServer(createIdentifier());
            server.listen(port);
            await once(server, 'listening');
        });

        mocha.afterEach(async () => {
            server.close();
            await once(server, 'close');
        });

        mocha.it('should emit connect & close events multiple times', (done) => {
            const connectCount = 10;
            let connect = 0, close = 0;

            //Client
            const client = new ScpClient(createIdentifier());
            assert.deepStrictEqual(client.address(), null);
            client.on('connect', () => {
                connect++;
                assert.deepStrictEqual(client.connected, true);
                assert.notDeepStrictEqual(client.address(), null);
                assert.deepStrictEqual(server.connections[0].canBroadcast, true);
                assert.deepStrictEqual(server.connections[0].identifier, client.identifier);
            });
            client.on('close', () => {
                close++;
                assert.deepStrictEqual(client.connected, false);
                assert.deepStrictEqual(client.address(), null);
            });
            (async () => {
                for (let i = 0; i < connectCount; i++) {
                    await promisify(client.connect).bind(client)(port, host);
                    await promisify(client.close).bind(client)(); //Calling End
                    assert.deepStrictEqual(connect, close);
                }
                done();
            })();
        });

        mocha.it('should emit close event on server close', (done) => {
            //Client
            const client = new ScpClient(createIdentifier());
            client.on('close', () => {
                done();
            });
            (async () => {
                await promisify(client.connect).bind(client)(port, host);
                await promisify(setTimeout)(1);//Delay for server to establish connection.
                await promisify(server.close).bind(server)(); //Calling End
            })();
        });
    });

    mocha.describe('Remote Function Test', () => {
        let server: ScpServer;
        let client: ScpClient;

        const nextHandler = (key: string) => {
            return (incoming: Incoming, outgoing: Outgoing, next: NextFunction) => {
                outgoing.setParam(key, '1');
                next();
            }
        }

        const replyHandler = () => {
            return (incoming: Incoming, outgoing: Outgoing, next: NextFunction) => {
                incoming.pipe(outgoing);
                incoming.on('signal', (event: string, args: Args) => outgoing.signal(event, args));
            }
        }

        const message = (client: ScpClient, map: string, body: string) => {
            return new Promise<{ incoming: Incoming, incomingBody: string }>((resolve, reject) => {
                const outgoing = client.createMessage(map, async (incoming: Incoming) => {
                    let incomingBody = '';
                    for await (const chunk of incoming) {
                        incomingBody += chunk;
                    }
                    resolve({ incoming, incomingBody });
                });
                outgoing.end(body);
            });
        }

        const echoMap = createMap(), spreadMap = createMap(), errorMap = createMap();
        const payloads = [null, 0, '', {}, [], [null], [0], [''], [{}], [[]], createBody(1000), { msg: createBody(1000) }, createBody(1000).split('')];

        mocha.beforeEach(async () => {
            server = new ScpServer(createIdentifier());
            server.createReply('*.a', nextHandler('*.a'));
            server.createReply('*.b', nextHandler('*.b'));
            server.createReply('A.*', nextHandler('A.*'));
            server.createReply('A.a', replyHandler());
            server.createReply('A.b', replyHandler());
            server.createReply('B.*', nextHandler('B.*'));
            server.createReply('B.a', replyHandler());
            server.createReply('B.b', replyHandler());
            server.reply(echoMap, ((arg) => arg));
            server.reply(spreadMap, ((...args) => args));
            server.reply(errorMap, ((arg) => { throw new Error(arg); }));
            server.createReply('*.*', replyHandler());
            server.listen(port);
            await once(server, 'listening');

            client = new ScpClient(createIdentifier());
            client.connect(port, host);
            await once(client, 'connect');
        });

        mocha.afterEach(async () => {
            server.close();
            await once(server, 'close');
        });

        mocha.it('should reply to message when className matches', async () => {
            //Client
            const outgoingBody = createBody(100);
            const { incoming, incomingBody } = await message(client, 'A.c', outgoingBody);
            assert.deepStrictEqual(incoming.mode, 'REPLY');
            assert.deepStrictEqual(incoming.map, 'A.c');
            assert.deepStrictEqual(incoming.getParam('SID'), server.identifier);
            assert.deepStrictEqual(incoming.getParam('*.a'), undefined);
            assert.deepStrictEqual(incoming.getParam('*.b'), undefined);
            assert.deepStrictEqual(incoming.getParam('A.*'), '1');
            assert.deepStrictEqual(incoming.getParam('B.*'), undefined);
            assert.deepStrictEqual(incomingBody, outgoingBody);
        });

        mocha.it('should reply to message when functionName matches', async () => {
            //Client
            const outgoingBody = createBody(100);
            const { incoming, incomingBody } = await message(client, 'C.a', outgoingBody);
            assert.deepStrictEqual(incoming.mode, 'REPLY');
            assert.deepStrictEqual(incoming.map, 'C.a');
            assert.deepStrictEqual(incoming.getParam('SID'), server.identifier);
            assert.deepStrictEqual(incoming.getParam('*.a'), '1');
            assert.deepStrictEqual(incoming.getParam('*.b'), undefined);
            assert.deepStrictEqual(incoming.getParam('A.*'), undefined);
            assert.deepStrictEqual(incoming.getParam('B.*'), undefined);
            assert.deepStrictEqual(incomingBody, outgoingBody);
        });

        mocha.it('should reply to message when className & functionName matches', async () => {
            //Client
            const outgoingBody = createBody(100);
            const { incoming, incomingBody } = await message(client, 'B.b', outgoingBody);
            assert.deepStrictEqual(incoming.mode, 'REPLY');
            assert.deepStrictEqual(incoming.map, 'B.b');
            assert.deepStrictEqual(incoming.getParam('SID'), server.identifier);
            assert.deepStrictEqual(incoming.getParam('*.a'), undefined);
            assert.deepStrictEqual(incoming.getParam('*.b'), '1');
            assert.deepStrictEqual(incoming.getParam('A.*'), undefined);
            assert.deepStrictEqual(incoming.getParam('B.*'), '1');
            assert.deepStrictEqual(incomingBody, outgoingBody);
        });

        mocha.it('should message(empty) and expect reply(empty)', async () => {
            //Client
            const reply = await client.message(echoMap);
            assert.deepStrictEqual(reply, {});
        });

        mocha.it('should message(...object) and expect reply(object)', async () => {
            //Client
            const reply = await client.message(spreadMap, ...payloads);
            assert.deepStrictEqual(reply, payloads);
        });

        mocha.it('should message(object) and expect reply(error)', async () => {
            //Client
            try {
                await client.message(errorMap, 'SCP Error');
            } catch (error) {
                assert.deepStrictEqual(error.message, 'SCP Error');
            }
        });

        mocha.it('should message(object) and expect reply(object) in sequence', async () => {
            //Client
            for (const message of payloads) {
                const reply = await client.message(echoMap, message);
                assert.deepStrictEqual(reply, message);
            }
        });

        mocha.it('should message(object) and expect reply(object) in parallel', async () => {
            //Client
            const reply = await Promise.all(payloads.map(async (message) => await client.message(echoMap, message)));
            assert.deepStrictEqual(reply, payloads);
        });

        mocha.it('should receive broadcast(empty)', async () => {
            //Server
            server.broadcast(echoMap);

            //Client
            const broadcast = await once(client, echoMap);
            assert.deepStrictEqual(broadcast, []);
        });

        mocha.it('should receive broadcast(...object)', async () => {
            //Server
            server.broadcast(spreadMap, ...payloads);

            //Client
            const broadcast = await once(client, spreadMap);
            assert.deepStrictEqual(broadcast, payloads);
        });

        mocha.it('should receive broadcast(object) in sequence', async () => {
            for (const payload of payloads) {
                //Server
                server.broadcast(echoMap, payload);

                //Client
                const broadcast = await once(client, echoMap);
                assert.deepStrictEqual(broadcast[0], payload)
            }
        });
    });
});