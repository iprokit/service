//Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';
import { promisify } from 'util';

//Import Local.
import { Params, Args, ScpClient, ScpServer, RemoteFunctionHandler } from '../lib';
import { createString, createIdentifier, clientMessage } from './util';

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

        const proceedHandler = (key: string): RemoteFunctionHandler => {
            return (incoming, outgoing, proceed) => {
                outgoing.setParam(key, '1');
                proceed();
            }
        }

        const replyHandler = (): RemoteFunctionHandler => {
            return (incoming, outgoing, proceed) => {
                incoming.pipe(outgoing);
                incoming.on('signal', (event: string, args: Args) => outgoing.signal(event, args));
            }
        }

        mocha.beforeEach(async () => {
            server = new ScpServer(createIdentifier());
            server.reply('*.a', proceedHandler('*.a'));
            server.reply('*.b', proceedHandler('*.b'));
            server.reply('A.*', proceedHandler('A.*'));
            server.reply('A.a', replyHandler());
            server.reply('A.b', replyHandler());
            server.reply('B.*', proceedHandler('B.*'));
            server.reply('B.a', replyHandler());
            server.reply('B.b', replyHandler());
            server.reply('*.*', replyHandler());
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

        mocha.describe('Message/Reply Test', () => {
            mocha.it('should receive reply to message when className matches', async () => {
                //Client
                const outgoingData = createString(1000);
                const { incoming, data: incomingData } = await clientMessage(client, 'A.c', outgoingData);
                assert.deepStrictEqual(incoming.mode, 'REPLY');
                assert.deepStrictEqual(incoming.operation, 'A.c');
                assert.deepStrictEqual(incoming.getParam('SID'), server.identifier);
                assert.deepStrictEqual(incoming.getParam('*.a'), undefined);
                assert.deepStrictEqual(incoming.getParam('*.b'), undefined);
                assert.deepStrictEqual(incoming.getParam('A.*'), '1');
                assert.deepStrictEqual(incoming.getParam('B.*'), undefined);
                assert.deepStrictEqual(incomingData, outgoingData);
            });

            mocha.it('should receive reply to message when functionName matches', async () => {
                //Client
                const outgoingData = createString(1000);
                const { incoming, data: incomingData } = await clientMessage(client, 'C.a', outgoingData);
                assert.deepStrictEqual(incoming.mode, 'REPLY');
                assert.deepStrictEqual(incoming.operation, 'C.a');
                assert.deepStrictEqual(incoming.getParam('SID'), server.identifier);
                assert.deepStrictEqual(incoming.getParam('*.a'), '1');
                assert.deepStrictEqual(incoming.getParam('*.b'), undefined);
                assert.deepStrictEqual(incoming.getParam('A.*'), undefined);
                assert.deepStrictEqual(incoming.getParam('B.*'), undefined);
                assert.deepStrictEqual(incomingData, outgoingData);
            });

            mocha.it('should receive reply to message when className & functionName matches', async () => {
                //Client
                const outgoingData = createString(1000);
                const { incoming, data: incomingData } = await clientMessage(client, 'B.b', outgoingData);
                assert.deepStrictEqual(incoming.mode, 'REPLY');
                assert.deepStrictEqual(incoming.operation, 'B.b');
                assert.deepStrictEqual(incoming.getParam('SID'), server.identifier);
                assert.deepStrictEqual(incoming.getParam('*.a'), undefined);
                assert.deepStrictEqual(incoming.getParam('*.b'), '1');
                assert.deepStrictEqual(incoming.getParam('A.*'), undefined);
                assert.deepStrictEqual(incoming.getParam('B.*'), '1');
                assert.deepStrictEqual(incomingData, outgoingData);
            });

            mocha.it('should throw SCP_CLIENT_INVALID_CONNECTION', async () => {
                //Client
                const scpClient = new ScpClient(createIdentifier());
                try {
                    const outgoing = scpClient.message('B.b', (incoming) => { });
                } catch (error) {
                    assert.deepStrictEqual(error.message, 'SCP_CLIENT_INVALID_CONNECTION');
                }
            });
        });

        mocha.describe('Broadcast Test', () => {
            mocha.it('should receive broadcast', async () => {
                //Server
                const outgoingData = createString(1000);
                server.broadcast('A.a', outgoingData, { A: 'a' });

                //Client
                const [incomingData, params] = await once(client, 'A.a') as [string, Params];
                assert.deepStrictEqual(incomingData, outgoingData);
                assert.deepStrictEqual(params.SID, server.identifier);
                assert.deepStrictEqual(params.A, 'a');
            });
        });
    });
});