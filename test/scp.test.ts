//Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';
import { promisify } from 'util';

//Import Local.
import { ScpServer, Executor, Segment, Nexus, IncomingHandler, ScpClient, Conductor } from '../lib';
import { createString, createIdentifier, clientOmni } from './util';

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

    mocha.describe('Broadcast Test', () => {
        let server: ScpServer;
        let client: ScpClient;

        const args = [null, 0, '', {}, [], [null], [0], [''], [{}], [[]], createString(1000), { arg: createString(1000) }, createString(1000).split('')];

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

        mocha.it('should receive broadcast as empty', async () => {
            //Server
            const [identifier] = await server.broadcast('nexus1');
            assert.deepStrictEqual(identifier, client.identifier);

            //Client
            const argsResolved = await once(client, 'nexus1');
            assert.deepStrictEqual(argsResolved, []);
        });

        mocha.it('should receive broadcast as object', async () => {
            for await (const arg of args) {
                //Server
                const [identifier] = await server.broadcast('nexus1', arg);
                assert.deepStrictEqual(identifier, client.identifier);

                //Client
                const argsResolved = await once(client, 'nexus1');
                assert.deepStrictEqual(argsResolved, [arg]);
            }
        });

        mocha.it('should receive broadcast as ...object', async () => {
            //Server
            const [identifier] = await server.broadcast('nexus1', ...args);
            assert.deepStrictEqual(identifier, client.identifier);

            //Client
            const argsResolved = await once(client, 'nexus1');
            assert.deepStrictEqual(argsResolved, args);
        });
    });

    mocha.describe('Register Test', () => {
        let server: ScpServer;

        const handler: IncomingHandler = (incoming, outgoing, proceed) => { }
        const validateNexus = (nexus: Nexus, operation: string, handler: IncomingHandler) => {
            assert.deepStrictEqual(nexus.operation, operation);
            assert.notDeepStrictEqual(nexus.regExp, undefined);
            assert.deepStrictEqual(nexus.handler, handler);
        }

        mocha.beforeEach(() => {
            server = new ScpServer(createIdentifier());
        });

        mocha.it('should register OMNI execution', () => {
            server.omni('', handler);
            server.omni('nexus', handler);
            server.omni('*', handler);
            validateNexus(server.executions[0] as Nexus, '', handler);
            validateNexus(server.executions[1] as Nexus, 'nexus', handler);
            validateNexus(server.executions[2] as Nexus, '*', handler);
            assert.deepStrictEqual(server.executions.length, 3);
        });
    });

    mocha.describe('Attach Test', () => {
        let server: ScpServer;

        const handler: IncomingHandler = (incoming, outgoing, proceed) => { }

        mocha.beforeEach(() => {
            server = new ScpServer(createIdentifier());
        });

        mocha.it('should attach executor', () => {
            const executor1 = new Executor();
            const executor2 = new Executor();
            executor2.omni('', handler);
            executor2.omni('nexus', handler);
            executor2.omni('*', handler);
            const executor3 = new Executor();
            server.attach('', executor1);
            server.attach('Segment', executor2);
            server.attach('*', executor3);
            assert.deepStrictEqual((server.executions[0] as Segment).operation, '');
            assert.notDeepStrictEqual((server.executions[0] as Segment).regExp, undefined);
            assert.deepStrictEqual((server.executions[0] as Segment).executions, executor1.executions);
            assert.deepStrictEqual((server.executions[0] as Segment).executions.length, 0);
            assert.deepStrictEqual((server.executions[1] as Segment).operation, 'Segment');
            assert.notDeepStrictEqual((server.executions[1] as Segment).regExp, undefined);
            assert.deepStrictEqual((server.executions[1] as Segment).executions, executor2.executions);
            assert.deepStrictEqual((server.executions[1] as Segment).executions.length, 3);
            assert.deepStrictEqual((server.executions[2] as Segment).operation, '*');
            assert.notDeepStrictEqual((server.executions[2] as Segment).regExp, undefined);
            assert.deepStrictEqual((server.executions[2] as Segment).executions, executor3.executions);
            assert.deepStrictEqual((server.executions[2] as Segment).executions.length, 0);
            assert.deepStrictEqual(server.executions.length, 3);
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

        mocha.it('should dispatch I/O to OMNI execution', async () => {
            //Server
            server.omni('nexus1', errorHandler);
            server.omni('nexus2', async (incoming, outgoing, proceed) => {
                incoming.pipe(outgoing);
            });
            server.omni('nexus3', errorHandler);

            //Client
            const outgoingData = createString(1000);
            const { incoming, data: incomingData } = await clientOmni(client, 'nexus2', outgoingData);
            assert.deepStrictEqual(incoming.mode, 'OMNI');
            assert.deepStrictEqual(incoming.operation, 'nexus2');
            assert.deepStrictEqual(incoming.get('SID'), server.identifier);
            assert.deepStrictEqual(incomingData, outgoingData);
        });

        mocha.it('should dispatch I/O to execution with wildcard operation', async () => {
            //Server
            server.omni('nex*1*3', proceedHandler);
            server.omni('nex*3', proceedHandler);
            server.omni('n*3', proceedHandler);
            server.omni('*', async (incoming, outgoing, proceed) => {
                assert.deepStrictEqual(proceedCalled, 3);
                incoming.pipe(outgoing);
            });

            //Client
            const outgoingData = createString(1000);
            const { incoming, data: incomingData } = await clientOmni(client, 'nexus123', outgoingData);
            assert.deepStrictEqual(incoming.mode, 'OMNI');
            assert.deepStrictEqual(incoming.operation, 'nexus123');
            assert.deepStrictEqual(incoming.get('SID'), server.identifier);
            assert.deepStrictEqual(incomingData, outgoingData);
        });

        mocha.it('should dispatch I/O to execution with case sensitivity in operation', async () => {
            //Server
            server.omni('NEXUS', errorHandler);
            server.omni('nexus', async (incoming, outgoing, proceed) => {
                incoming.pipe(outgoing);
            });

            //Client
            const outgoingData = createString(1000);
            const { incoming, data: incomingData } = await clientOmni(client, 'nexus', outgoingData);
            assert.deepStrictEqual(incoming.mode, 'OMNI');
            assert.deepStrictEqual(incoming.operation, 'nexus');
            assert.deepStrictEqual(incoming.get('SID'), server.identifier);
            assert.deepStrictEqual(incomingData, outgoingData);
        });

        mocha.it('should dispatch I/O to execution with registration order', async () => {
            //Server
            server.omni('nexus', proceedHandler);
            server.omni('nexus', async (incoming, outgoing, proceed) => {
                assert.deepStrictEqual(proceedCalled, 1);
                incoming.pipe(outgoing);
            });
            server.omni('nexus', errorHandler);

            //Client
            const outgoingData = createString(1000);
            const { incoming, data: incomingData } = await clientOmni(client, 'nexus', outgoingData);
            assert.deepStrictEqual(incoming.mode, 'OMNI');
            assert.deepStrictEqual(incoming.operation, 'nexus');
            assert.deepStrictEqual(incoming.get('SID'), server.identifier);
            assert.deepStrictEqual(incomingData, outgoingData);
        });

        mocha.it('should dispatch I/O to executor attached', async () => {
            //Server
            const executor1 = new Executor();
            executor1.omni('*', proceedHandler);
            const executor2 = new Executor();
            executor2.omni('*', errorHandler);
            const executor3 = new Executor();
            executor3.omni('*', proceedHandler);
            executor3.omni('nexus', async (incoming, outgoing, proceed) => {
                assert.deepStrictEqual(proceedCalled, 2);
                incoming.pipe(outgoing);
            });
            const executor4 = new Executor();
            server.attach('*', executor1);
            server.attach('Segment2', executor2);
            server.attach('Segment3', executor3);
            server.attach('Segment4', executor4);

            //Client
            const outgoingData = createString(1000);
            const { incoming, data: incomingData } = await clientOmni(client, 'Segment3.nexus', outgoingData);
            assert.deepStrictEqual(incoming.mode, 'OMNI');
            assert.deepStrictEqual(incoming.operation, 'Segment3.nexus');
            assert.deepStrictEqual(incoming.get('SID'), server.identifier);
            assert.deepStrictEqual(incomingData, outgoingData);
        });

        mocha.it('should dispatch I/O through executions & executors', async () => {
            //Server
            const executor1 = new Executor();
            executor1.omni('*', proceedHandler);
            const executor2 = new Executor();
            executor2.omni('*', errorHandler);
            const executor3 = new Executor();
            executor3.omni('*', proceedHandler);
            executor3.omni('nexus', async (incoming, outgoing, proceed) => {
                assert.deepStrictEqual(proceedCalled, 2);
                incoming.pipe(outgoing);
            });
            const executor4 = new Executor();
            server.omni('*', proceedHandler);
            server.omni('nexus1', errorHandler);
            server.omni('*1', errorHandler);
            server.omni('nex*', proceedHandler);
            server.omni('nexus2', async (incoming, outgoing, proceed) => {
                assert.deepStrictEqual(proceedCalled, 2);
                incoming.pipe(outgoing);
            });
            server.omni('nexus3', errorHandler);
            server.attach('*', executor1);
            server.attach('Segment2', executor2);
            server.attach('Segment3', executor3);
            server.attach('Segment4', executor4);
            server.omni('nexus3', errorHandler);

            //Client 1
            const outgoingData1 = createString(1000);
            const { incoming: incoming1, data: incomingData1 } = await clientOmni(client, 'nexus2', outgoingData1);
            assert.deepStrictEqual(incoming1.mode, 'OMNI');
            assert.deepStrictEqual(incoming1.operation, 'nexus2');
            assert.deepStrictEqual(incoming1.get('SID'), server.identifier);
            assert.deepStrictEqual(incomingData1, outgoingData1);

            //Rest
            proceedCalled = 0;

            //Client 2
            const outgoingData2 = createString(1000);
            const { incoming: incoming2, data: incomingData2 } = await clientOmni(client, 'Segment3.nexus', outgoingData2);
            assert.deepStrictEqual(incoming2.mode, 'OMNI');
            assert.deepStrictEqual(incoming2.operation, 'Segment3.nexus');
            assert.deepStrictEqual(incoming2.get('SID'), server.identifier);
            assert.deepStrictEqual(incomingData2, outgoingData2);
        });

        mocha.it('should throw SCP_CLIENT_INVALID_CONNECTION', () => {
            //Client
            const scpClient = new ScpClient(createIdentifier());
            try {
                const outgoing = scpClient.omni('nexus1', (incoming) => { });
            } catch (error) {
                assert.deepStrictEqual((error as Error).message, 'SCP_CLIENT_INVALID_CONNECTION');
            }
        });
    });

    mocha.describe('Remote Function Test', () => {
        let server: ScpServer;
        let client: ScpClient;

        const args = [null, 0, '', {}, [], [null], [0], [''], [{}], [[]], createString(1000), { arg: createString(1000) }, createString(1000).split('')];

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

        mocha.it('should execute remote function as empty', async () => {
            //Server
            server.func('nexus', (arg) => {
                assert.deepStrictEqual(arg, undefined);
                return;
            });

            //Client
            const returned = await client.execute('nexus');
            assert.deepStrictEqual(returned, {});
        });

        mocha.it('should execute remote function as object', async () => {
            //Server
            server.func('nexus', (arg) => {
                return arg;
            });

            //Client
            for (const arg of args) {
                const returned = await client.execute('nexus', arg);
                assert.deepStrictEqual(returned, arg);
            }
        });

        mocha.it('should execute remote function as ...object', async () => {
            //Server
            server.func('nexus', (...args) => {
                return args;
            });

            //Client
            const returned = await client.execute('nexus', ...args);
            assert.deepStrictEqual(returned, args);
        });

        mocha.it('should execute remote function with conductor', async () => {
            //Server
            server.func('nexus', (args, conductor: Conductor) => {
                return args;
            });

            //Client
            const conductor = new Conductor();
            const returned = await client.execute('nexus', args, conductor);
            assert.deepStrictEqual(returned, args);
        });

        mocha.it('should execute remote function as error', async () => {
            //Server
            server.func('nexus', (arg) => {
                throw new Error(arg);
            });

            //Client
            try {
                const returned = await client.execute('nexus', 'SCP Error');
            } catch (error) {
                assert.deepStrictEqual((error as Error).message, 'SCP Error');
            }
        });
    });
});