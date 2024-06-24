//Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';
import { promisify } from 'util';

//Import Local.
import { ScpClient, ScpServer, Grid, Nexus, IncomingHandler } from '../lib';
import { createString, createIdentifier, clientOnBroadcast, clientOmni } from './util';

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

        mocha.it('should receive data on BROADCAST', async () => {
            //Server
            const outgoingData = createString(1000);
            server.broadcast('nexus1', outgoingData, [['A', 'a']]);

            //Client
            const { data: incomingData, params } = await clientOnBroadcast(client, 'nexus1');
            assert.deepStrictEqual(incomingData, outgoingData);
            assert.deepStrictEqual(params.get('SID'), server.identifier);
            assert.deepStrictEqual(params.get('A'), 'a');
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

        mocha.it('should register OMNI coordinate', () => {
            server.omni('', handler);
            server.omni('nexus', handler);
            server.omni('*', handler);
            validateNexus(server.coordinates[0] as Nexus, '', handler);
            validateNexus(server.coordinates[1] as Nexus, 'nexus', handler);
            validateNexus(server.coordinates[2] as Nexus, '*', handler);
            assert.deepStrictEqual(server.coordinates.length, 3);
        });
    });

    mocha.describe('Attach Test', () => {
        let server: ScpServer;

        const handler: IncomingHandler = (incoming, outgoing, proceed) => { }

        mocha.beforeEach(() => {
            server = new ScpServer(createIdentifier());
        });

        mocha.it('should attach coordinator', () => {
            const coordinator1 = server.Coordinate();
            const coordinator2 = server.Coordinate();
            coordinator2.omni('', handler);
            coordinator2.omni('nexus', handler);
            coordinator2.omni('*', handler);
            const coordinator3 = server.Coordinate();
            server.attach('', coordinator1);
            server.attach('Grid', coordinator2);
            server.attach('*', coordinator3);
            assert.deepStrictEqual((server.coordinates[0] as Grid).operation, '');
            assert.notDeepStrictEqual((server.coordinates[0] as Grid).regExp, undefined);
            assert.deepStrictEqual((server.coordinates[0] as Grid).coordinates, coordinator1.coordinates);
            assert.deepStrictEqual((server.coordinates[0] as Grid).coordinates.length, 0);
            assert.deepStrictEqual((server.coordinates[1] as Grid).operation, 'Grid');
            assert.notDeepStrictEqual((server.coordinates[1] as Grid).regExp, undefined);
            assert.deepStrictEqual((server.coordinates[1] as Grid).coordinates, coordinator2.coordinates);
            assert.deepStrictEqual((server.coordinates[1] as Grid).coordinates.length, 3);
            assert.deepStrictEqual((server.coordinates[2] as Grid).operation, '*');
            assert.notDeepStrictEqual((server.coordinates[2] as Grid).regExp, undefined);
            assert.deepStrictEqual((server.coordinates[2] as Grid).coordinates, coordinator3.coordinates);
            assert.deepStrictEqual((server.coordinates[2] as Grid).coordinates.length, 0);
            assert.deepStrictEqual(server.coordinates.length, 3);
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

        mocha.it('should dispatch I/O to OMNI coordinate', async () => {
            //Server
            server.omni('nexus1', errorHandler);
            server.omni('nexus2', (incoming, outgoing, proceed) => {
                outgoing.end('END');
            });
            server.omni('nexus3', errorHandler);

            //Client
            const { incoming, data } = await clientOmni(client, 'nexus2', '');
            assert.deepStrictEqual(incoming.mode, 'OMNI');
            assert.deepStrictEqual(incoming.operation, 'nexus2');
            assert.deepStrictEqual(incoming.get('SID'), server.identifier);
            assert.deepStrictEqual(data, 'END');
        });

        mocha.it('should dispatch I/O to coordinate with wildcard operation', async () => {
            //Server
            server.omni('nex*1*3', proceedHandler);
            server.omni('nex*3', proceedHandler);
            server.omni('n*3', proceedHandler);
            server.omni('*', (incoming, outgoing, proceed) => {
                assert.deepStrictEqual(proceedCalled, 3);
                outgoing.end('END');
            });

            //Client
            const { incoming, data } = await clientOmni(client, 'nexus123', '');
            assert.deepStrictEqual(incoming.mode, 'OMNI');
            assert.deepStrictEqual(incoming.operation, 'nexus123');
            assert.deepStrictEqual(incoming.get('SID'), server.identifier);
            assert.deepStrictEqual(data, 'END');
        });

        mocha.it('should dispatch I/O to coordinate with case sensitivity in operation', async () => {
            //Server
            server.omni('NEXUS', errorHandler);
            server.omni('nexus', (incoming, outgoing, proceed) => {
                outgoing.end('END');
            });

            //Client
            const { incoming, data } = await clientOmni(client, 'nexus', '');
            assert.deepStrictEqual(incoming.mode, 'OMNI');
            assert.deepStrictEqual(incoming.operation, 'nexus');
            assert.deepStrictEqual(incoming.get('SID'), server.identifier);
            assert.deepStrictEqual(data, 'END');
        });

        mocha.it('should dispatch I/O to coordinate with registration order', async () => {
            //Server
            server.omni('nexus', proceedHandler);
            server.omni('nexus', (incoming, outgoing, proceed) => {
                assert.deepStrictEqual(proceedCalled, 1);
                outgoing.end('END');
            });
            server.omni('nexus', errorHandler);

            //Client
            const { incoming, data } = await clientOmni(client, 'nexus', '');
            assert.deepStrictEqual(incoming.mode, 'OMNI');
            assert.deepStrictEqual(incoming.operation, 'nexus');
            assert.deepStrictEqual(incoming.get('SID'), server.identifier);
            assert.deepStrictEqual(data, 'END');
        });

        mocha.it('should dispatch I/O to coordinator attached', async () => {
            //Server
            const coordinator1 = server.Coordinate();
            coordinator1.omni('*', proceedHandler);
            const coordinator2 = server.Coordinate();
            coordinator2.omni('*', errorHandler);
            const coordinator3 = server.Coordinate();
            coordinator3.omni('*', proceedHandler);
            coordinator3.omni('nexus', (incoming, outgoing, proceed) => {
                assert.deepStrictEqual(proceedCalled, 2);
                outgoing.end('END');
            });
            const coordinator4 = server.Coordinate();
            server.attach('*', coordinator1);
            server.attach('Grid2', coordinator2);
            server.attach('Grid3', coordinator3);
            server.attach('Grid4', coordinator4);

            //Client
            const { incoming, data } = await clientOmni(client, 'Grid3.nexus', '');
            assert.deepStrictEqual(incoming.mode, 'OMNI');
            assert.deepStrictEqual(incoming.operation, 'Grid3.nexus');
            assert.deepStrictEqual(incoming.get('SID'), server.identifier);
            assert.deepStrictEqual(data, 'END');
        });

        mocha.it('should dispatch I/O through coordinates & coordinators', async () => {
            //Server
            const coordinator1 = server.Coordinate();
            coordinator1.omni('*', proceedHandler);
            const coordinator2 = server.Coordinate();
            coordinator2.omni('*', errorHandler);
            const coordinator3 = server.Coordinate();
            coordinator3.omni('*', proceedHandler);
            coordinator3.omni('nexus', (incoming, outgoing, proceed) => {
                assert.deepStrictEqual(proceedCalled, 2);
                outgoing.end('END');
            });
            const coordinator4 = server.Coordinate();
            server.omni('*', proceedHandler);
            server.omni('nexus1', errorHandler);
            server.omni('*1', errorHandler);
            server.omni('nex*', proceedHandler);
            server.omni('nexus2', (incoming, outgoing, proceed) => {
                assert.deepStrictEqual(proceedCalled, 2);
                outgoing.end('END');
            });
            server.omni('nexus3', errorHandler);
            server.attach('*', coordinator1);
            server.attach('Grid2', coordinator2);
            server.attach('Grid3', coordinator3);
            server.attach('Grid4', coordinator4);
            server.omni('nexus3', errorHandler);

            //Client 1
            const { incoming: incoming1, data: data1 } = await clientOmni(client, 'nexus2', '');
            assert.deepStrictEqual(incoming1.mode, 'OMNI');
            assert.deepStrictEqual(incoming1.operation, 'nexus2');
            assert.deepStrictEqual(incoming1.get('SID'), server.identifier);
            assert.deepStrictEqual(data1, 'END');

            //Rest
            proceedCalled = 0;

            //Client 2
            const { incoming: incoming2, data: data2 } = await clientOmni(client, 'Grid3.nexus', '');
            assert.deepStrictEqual(incoming2.mode, 'OMNI');
            assert.deepStrictEqual(incoming2.operation, 'Grid3.nexus');
            assert.deepStrictEqual(incoming2.get('SID'), server.identifier);
            assert.deepStrictEqual(data2, 'END');
        });

        mocha.it('should throw SCP_CLIENT_INVALID_CONNECTION', () => {
            //Client
            const scpClient = new ScpClient(createIdentifier());
            try {
                const outgoing = scpClient.omni('nexus1', (incoming) => { });
            } catch (error) {
                assert.deepStrictEqual(error.message, 'SCP_CLIENT_INVALID_CONNECTION');
            }
        });
    });
});