//Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';
import { promisify } from 'util';

//Import Local.
import { Params, ScpClient, ScpServer, RemoteClass, RemoteFunction, ScpMode, IncomingHandler } from '../lib';
import { createString, createIdentifier, clientMessage } from './util';

const host = '127.0.0.1';
const port = 6000;

mocha.describe('SCP Test', () => {
    mocha.describe('Constructor Test', () => {
        mocha.it('should construct server', () => {
            const identifier = createIdentifier();
            const server = new ScpServer(identifier);
            assert.deepStrictEqual(server.identifier, identifier);
        });

        mocha.it('should construct client', () => {
            const identifier = createIdentifier();
            const client = new ScpClient(identifier);
            assert.deepStrictEqual(client.identifier, identifier);
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

    mocha.describe('Register Test', () => {
        let server: ScpServer;

        const handler: IncomingHandler = (incoming, outgoing, proceed) => { }
        const validateRemoteFunction = (remoteFunction: RemoteFunction, mode: ScpMode, operation: string, handler: IncomingHandler) => {
            assert.deepStrictEqual(remoteFunction.mode, mode);
            assert.deepStrictEqual(remoteFunction.operation, operation);
            assert.notDeepStrictEqual(remoteFunction.regExp, undefined);
            assert.deepStrictEqual(remoteFunction.handler, handler);
        }

        mocha.beforeEach(() => {
            server = new ScpServer(createIdentifier());
        });

        mocha.it('should register REPLY remote', () => {
            server.reply('', handler);
            server.reply('function', handler);
            server.reply('*', handler);
            validateRemoteFunction(server.remotes[0] as RemoteFunction, 'REPLY', '', handler);
            validateRemoteFunction(server.remotes[1] as RemoteFunction, 'REPLY', 'function', handler);
            validateRemoteFunction(server.remotes[2] as RemoteFunction, 'REPLY', '*', handler);
            assert.deepStrictEqual(server.remotes.length, 3);
        });
    });

    mocha.describe('Attach Test', () => {
        let server: ScpServer;

        const handler: IncomingHandler = (incoming, outgoing, proceed) => { }

        mocha.beforeEach(() => {
            server = new ScpServer(createIdentifier());
        });

        mocha.it('should attach remote', () => {
            const receiver1 = server.Remote();
            const receiver2 = server.Remote();
            receiver2.reply('', handler);
            receiver2.reply('function', handler);
            receiver2.reply('*', handler);
            const receiver3 = server.Remote();
            server.attach('', receiver1);
            server.attach('Class', receiver2);
            server.attach('*', receiver3);
            assert.deepStrictEqual((server.remotes[0] as RemoteClass).operation, '');
            assert.notDeepStrictEqual((server.remotes[0] as RemoteClass).regExp, undefined);
            assert.deepStrictEqual((server.remotes[0] as RemoteClass).functions, receiver1.remotes);
            assert.deepStrictEqual((server.remotes[0] as RemoteClass).functions.length, 0);
            assert.deepStrictEqual((server.remotes[1] as RemoteClass).operation, 'Class');
            assert.notDeepStrictEqual((server.remotes[1] as RemoteClass).regExp, undefined);
            assert.deepStrictEqual((server.remotes[1] as RemoteClass).functions, receiver2.remotes);
            assert.deepStrictEqual((server.remotes[1] as RemoteClass).functions.length, 3);
            assert.deepStrictEqual((server.remotes[2] as RemoteClass).operation, '*');
            assert.notDeepStrictEqual((server.remotes[2] as RemoteClass).regExp, undefined);
            assert.deepStrictEqual((server.remotes[2] as RemoteClass).functions, receiver3.remotes);
            assert.deepStrictEqual((server.remotes[2] as RemoteClass).functions.length, 0);
            assert.deepStrictEqual(server.remotes.length, 3);
        });
    });

    mocha.describe('Dispatch Test', () => {
        let proceedCalled: number;
        let server: ScpServer;
        let client: ScpClient;

        const proceedHandler: IncomingHandler = (incoming, outgoing, proceed) => {
            proceedCalled++;
            proceed();
        }

        const errorHandler: IncomingHandler = (incoming, outgoing, proceed) => {
            throw new Error('Should not be called');
        }

        mocha.beforeEach(async () => {
            proceedCalled = 0;
            server = new ScpServer(createIdentifier());
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

        mocha.it('should dispatch I/O to REPLY remote', async () => {
            //Server
            server.reply('function1', errorHandler);
            server.reply('function2', (incoming, outgoing, proceed) => {
                outgoing.end('END');
            });
            server.reply('function3', errorHandler);

            //Client
            const { incoming, data } = await clientMessage(client, 'function2', '');
            assert.deepStrictEqual(incoming.mode, 'REPLY');
            assert.deepStrictEqual(incoming.operation, 'function2');
            assert.deepStrictEqual(incoming.get('SID'), server.identifier);
            assert.deepStrictEqual(data, 'END');
        });

        mocha.it('should dispatch I/O to remote with wildcard operation', async () => {
            //Server
            server.reply('fun*1*3', proceedHandler);
            server.reply('fun*3', proceedHandler);
            server.reply('f*3', proceedHandler);
            server.reply('*', (incoming, outgoing, proceed) => {
                assert.deepStrictEqual(proceedCalled, 3);
                outgoing.end('END');
            });

            //Client
            const { incoming, data } = await clientMessage(client, 'function123', '');
            assert.deepStrictEqual(incoming.mode, 'REPLY');
            assert.deepStrictEqual(incoming.operation, 'function123');
            assert.deepStrictEqual(incoming.get('SID'), server.identifier);
            assert.deepStrictEqual(data, 'END');
        });

        mocha.it('should dispatch I/O to remote with case sensitivity in operation', async () => {
            //Server
            server.reply('FUNCTION', errorHandler);
            server.reply('function', (incoming, outgoing, proceed) => {
                outgoing.end('END');
            });

            //Client
            const { incoming, data } = await clientMessage(client, 'function', '');
            assert.deepStrictEqual(incoming.mode, 'REPLY');
            assert.deepStrictEqual(incoming.operation, 'function');
            assert.deepStrictEqual(incoming.get('SID'), server.identifier);
            assert.deepStrictEqual(data, 'END');
        });

        mocha.it('should dispatch I/O to remote with registration order', async () => {
            //Server
            server.reply('function', proceedHandler);
            server.reply('function', (incoming, outgoing, proceed) => {
                assert.deepStrictEqual(proceedCalled, 1);
                outgoing.end('END');
            });
            server.reply('function', errorHandler);

            //Client
            const { incoming, data } = await clientMessage(client, 'function', '');
            assert.deepStrictEqual(incoming.mode, 'REPLY');
            assert.deepStrictEqual(incoming.operation, 'function');
            assert.deepStrictEqual(incoming.get('SID'), server.identifier);
            assert.deepStrictEqual(data, 'END');
        });

        mocha.it('should dispatch I/O to receiver attached', async () => {
            //Server
            const receiver1 = server.Remote();
            receiver1.reply('*', proceedHandler);
            const receiver2 = server.Remote();
            receiver2.reply('*', errorHandler);
            const receiver3 = server.Remote();
            receiver3.reply('*', proceedHandler);
            receiver3.reply('function', (incoming, outgoing, proceed) => {
                assert.deepStrictEqual(proceedCalled, 2);
                outgoing.end('END');
            });
            const receiver4 = server.Remote();
            server.attach('*', receiver1);
            server.attach('Class2', receiver2);
            server.attach('Class3', receiver3);
            server.attach('Class4', receiver4);

            //Client
            const { incoming, data } = await clientMessage(client, 'Class3.function', '');
            assert.deepStrictEqual(incoming.mode, 'REPLY');
            assert.deepStrictEqual(incoming.operation, 'Class3.function');
            assert.deepStrictEqual(incoming.get('SID'), server.identifier);
            assert.deepStrictEqual(data, 'END');
        });

        mocha.it('should dispatch I/O through remotes & receivers', async () => {
            //Server
            const receiver1 = server.Remote();
            receiver1.reply('*', proceedHandler);
            const receiver2 = server.Remote();
            receiver2.reply('*', errorHandler);
            const receiver3 = server.Remote();
            receiver3.reply('*', proceedHandler);
            receiver3.reply('function', (incoming, outgoing, proceed) => {
                assert.deepStrictEqual(proceedCalled, 2);
                outgoing.end('END');
            });
            const receiver4 = server.Remote();
            server.reply('*', proceedHandler);
            server.reply('function1', errorHandler);
            server.reply('*1', errorHandler);
            server.reply('func*', proceedHandler);
            server.reply('function2', (incoming, outgoing, proceed) => {
                assert.deepStrictEqual(proceedCalled, 2);
                outgoing.end('END');
            });
            server.reply('function3', errorHandler);
            server.attach('*', receiver1);
            server.attach('Class2', receiver2);
            server.attach('Class3', receiver3);
            server.attach('Class4', receiver4);
            server.reply('function3', errorHandler);

            //Client 1
            const { incoming: incoming1, data: data1 } = await clientMessage(client, 'function2', '');
            assert.deepStrictEqual(incoming1.mode, 'REPLY');
            assert.deepStrictEqual(incoming1.operation, 'function2');
            assert.deepStrictEqual(incoming1.get('SID'), server.identifier);
            assert.deepStrictEqual(data1, 'END');

            //Rest
            proceedCalled = 0;

            //Client 2
            const { incoming: incoming2, data: data2 } = await clientMessage(client, 'Class3.function', '');
            assert.deepStrictEqual(incoming2.mode, 'REPLY');
            assert.deepStrictEqual(incoming2.operation, 'Class3.function');
            assert.deepStrictEqual(incoming2.get('SID'), server.identifier);
            assert.deepStrictEqual(data2, 'END');
        });

        mocha.it('should throw SCP_CLIENT_INVALID_CONNECTION', () => {
            //Client
            const scpClient = new ScpClient(createIdentifier());
            try {
                const outgoing = scpClient.message('function1', (incoming) => { });
            } catch (error) {
                assert.deepStrictEqual(error.message, 'SCP_CLIENT_INVALID_CONNECTION');
            }
        });
    });

    mocha.describe('Broadcast Test', () => {
        let server: ScpServer;
        let client: ScpClient;

        mocha.beforeEach(async () => {
            server = new ScpServer(createIdentifier());
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

        mocha.it('should receive broadcast', async () => {
            //Server
            const outgoingData = createString(1000);
            server.broadcast('function1', outgoingData, [['A', 'a']]);

            //Client
            const [incomingData, params] = await once(client, 'function1') as [string, Params];
            assert.deepStrictEqual(incomingData, outgoingData);
            assert.deepStrictEqual(params.get('SID'), server.identifier);
            assert.deepStrictEqual(params.get('A'), 'a');
        });
    });
});