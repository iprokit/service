//Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';
import { promisify } from 'util';

//Import Local.
import { Params, Args, ScpClient, ScpServer, IncomingHandler } from '../lib';
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
            const connectCount = 20;
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
                    client.connect(port, host);
                    await once(client, 'connect');
                    client.close();//Calling End
                    await once(client, 'close');
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
                client.connect(port, host);
                await once(client, 'connect');
                await promisify(setTimeout)(1);//Delay for server to establish connection.
                server.close();
                await once(server, 'close'); //Calling End
            })();
        });
    });

    mocha.describe('Remote Function Test', () => {
        let server: ScpServer;
        let client: ScpClient;

        const proceedHandler = (key: string): IncomingHandler => {
            return (incoming, outgoing, proceed) => {
                outgoing.set(key, '1');
                proceed();
            }
        }

        const incomingHandler = (): IncomingHandler => {
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
            server.reply('A.a', incomingHandler());
            server.reply('A.b', incomingHandler());
            server.reply('B.*', proceedHandler('B.*'));
            server.reply('B.a', incomingHandler());
            server.reply('B.b', incomingHandler());
            server.reply('*.*', incomingHandler());
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
                assert.deepStrictEqual(incoming.get('SID'), server.identifier);
                assert.deepStrictEqual(incoming.has('*.a'), false);
                assert.deepStrictEqual(incoming.has('*.b'), false);
                assert.deepStrictEqual(incoming.get('A.*'), '1');
                assert.deepStrictEqual(incoming.has('B.*'), false);
                assert.deepStrictEqual(incomingData, outgoingData);
            });

            mocha.it('should receive reply to message when functionName matches', async () => {
                //Client
                const outgoingData = createString(1000);
                const { incoming, data: incomingData } = await clientMessage(client, 'C.a', outgoingData);
                assert.deepStrictEqual(incoming.mode, 'REPLY');
                assert.deepStrictEqual(incoming.operation, 'C.a');
                assert.deepStrictEqual(incoming.get('SID'), server.identifier);
                assert.deepStrictEqual(incoming.get('*.a'), '1');
                assert.deepStrictEqual(incoming.has('*.b'), false);
                assert.deepStrictEqual(incoming.has('A.*'), false);
                assert.deepStrictEqual(incoming.has('B.*'), false);
                assert.deepStrictEqual(incomingData, outgoingData);
            });

            mocha.it('should receive reply to message when className & functionName matches', async () => {
                //Client
                const outgoingData = createString(1000);
                const { incoming, data: incomingData } = await clientMessage(client, 'B.b', outgoingData);
                assert.deepStrictEqual(incoming.mode, 'REPLY');
                assert.deepStrictEqual(incoming.operation, 'B.b');
                assert.deepStrictEqual(incoming.get('SID'), server.identifier);
                assert.deepStrictEqual(incoming.has('*.a'), false);
                assert.deepStrictEqual(incoming.get('*.b'), '1');
                assert.deepStrictEqual(incoming.has('A.*'), false);
                assert.deepStrictEqual(incoming.get('B.*'), '1');
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
                server.broadcast('A.a', outgoingData, [['A', 'a']]);

                //Client
                const [incomingData, params] = await once(client, 'A.a') as [string, Params];
                assert.deepStrictEqual(incomingData, outgoingData);
                assert.deepStrictEqual(params.get('SID'), server.identifier);
                assert.deepStrictEqual(params.get('A'), 'a');
            });
        });
    });
});