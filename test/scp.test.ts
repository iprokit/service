// Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';
import { promisify } from 'util';

// Import Local.
import { Server, Executor, IExecutor, Segment, Nexus, IncomingHandler, Mode, Client, ClientOptions, Socket, Orchestrator, Conductor, Signal, Tags } from '../lib/scp';
import { createString, createIdentifier, clientIO, read } from './util';

const host = '127.0.0.1';
const port = 6000;

mocha.describe('SCP Test', () => {
	mocha.describe('Constructor Base Test', () => {
		mocha.it('should construct server', () => {
			const identifier = createIdentifier();
			const server = new Server(identifier);
			assert.deepStrictEqual(server.identifier, identifier);
			assert.deepStrictEqual(server.executions, new Array());
		});

		mocha.it('should construct client', () => {
			const identifier = createIdentifier();
			const client = new Client(identifier);
			assert.deepStrictEqual(client.identifier, identifier);
		});
	});

	mocha.describe('Connection Test', () => {
		let server: Server;

		mocha.beforeEach(async () => {
			server = new Server(createIdentifier());
		});

		mocha.it('should emit listening, scp:connection, incoming & close events for single connection', async () => {
			// Client
			const client = new Client(createIdentifier());

			// Server
			server.listen(port);
			await once(server, 'listening');
			assert.deepStrictEqual(server.listening, true);
			assert.deepStrictEqual(await new Promise((resolve) => server.getConnections((error, count) => resolve(count))), 0);
			await (async () => {
				client.connect(port, host);
				await Promise.all([once(server, 'scp:connection'), once(server, 'incoming'), once(client, 'connect')]);
				assert.deepStrictEqual(await new Promise((resolve) => server.getConnections((error, count) => resolve(count))), 1);
			})();
			server.close(); // Server 1st Close.
			await Promise.all([once(server, 'close'), once(client, 'close')]);
			assert.deepStrictEqual(server.listening, false);
			assert.deepStrictEqual(await new Promise((resolve) => server.getConnections((error, count) => resolve(count))), 0);
		});

		mocha.it('should emit listening, scp:connection incoming & close events for multiple connections', async () => {
			// Client
			const clients = Array(20)
				.fill({})
				.map(() => new Client(createIdentifier()));

			// Server
			server.listen(port);
			await once(server, 'listening');
			assert.deepStrictEqual(server.listening, true);
			assert.deepStrictEqual(await new Promise((resolve) => server.getConnections((error, count) => resolve(count))), 0);
			for (let i = 0; i < clients.length; i++) {
				clients[i].connect(port, host);
				await Promise.all([once(server, 'scp:connection'), once(server, 'incoming'), once(clients[i], 'connect')]);
				assert.deepStrictEqual(await new Promise((resolve) => server.getConnections((error, count) => resolve(count))), i + 1);
			}
			server.close(); // Server 1st Close.
			await Promise.all([once(server, 'close'), ...clients.map((client) => once(client, 'close'))]);
			assert.deepStrictEqual(server.listening, false);
			assert.deepStrictEqual(await new Promise((resolve) => server.getConnections((error, count) => resolve(count))), 0);
		});

		mocha.it('should emit connect & close events multiple times', async () => {
			const connectCount = 20;

			// Client
			const client = new Client(createIdentifier());
			assert.deepStrictEqual(client.remotePort, null);
			assert.deepStrictEqual(client.remoteAddress, null);
			assert.deepStrictEqual(client.connected, false);
			assert.deepStrictEqual(client.pool, { size: 0, busy: 0, idle: 0 });
			// Server
			server.listen(port);
			await once(server, 'listening');
			for (let i = 0; i < connectCount; i++) {
				client.connect(port, host);
				await once(client, 'connect');
				assert.deepStrictEqual(client.remotePort, port);
				assert.deepStrictEqual(client.remoteAddress, host);
				assert.deepStrictEqual(client.connected, true);
				assert.deepStrictEqual(client.pool, { size: 1, busy: 1, idle: 0 });
				client.close(); // Client 1st Close.
				await once(client, 'close');
				assert.deepStrictEqual(client.remotePort, null);
				assert.deepStrictEqual(client.remoteAddress, null);
				assert.deepStrictEqual(client.connected, false);
				assert.deepStrictEqual(client.pool, { size: 0, busy: 0, idle: 0 });
			}
			server.close();
			await once(server, 'close');
		});
	});

	mocha.describe('Broadcast Test', () => {
		let server: Server;
		let client: Client;

		const args = [null, 0, '', {}, [], [null], [0], [''], [{}], [[]], createString(1000), { arg: createString(1000) }, createString(1000).split('')];

		mocha.beforeEach(async () => {
			server = new Server(createIdentifier());
			server.listen(port);
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

		mocha.it('should receive broadcast as empty', async () => {
			// Server
			const [identifier] = await server.broadcast('nexus1');
			assert.deepStrictEqual(identifier, client.identifier);

			// Client
			const argsResolved = await once(client, 'nexus1');
			assert.deepStrictEqual(argsResolved, []);
		});

		mocha.it('should receive broadcast as object', async () => {
			for await (const arg of args) {
				// Server
				const [identifier] = await server.broadcast('nexus1', arg);
				assert.deepStrictEqual(identifier, client.identifier);

				// Client
				const argsResolved = await once(client, 'nexus1');
				assert.deepStrictEqual(argsResolved, [arg]);
			}
		});

		mocha.it('should receive broadcast as ...object', async () => {
			// Server
			const [identifier] = await server.broadcast('nexus1', ...args);
			assert.deepStrictEqual(identifier, client.identifier);

			// Client
			const argsResolved = await once(client, 'nexus1');
			assert.deepStrictEqual(argsResolved, args);
		});
	});

	mocha.describe('Register Test', () => {
		let server: Server;

		const remoteFunction = (...args: Array<any>) => {};
		const handler: IncomingHandler = (incoming, outgoing, proceed) => {};
		const validateNexus = (nexus: Nexus, mode: Mode, operation: string, handler?: IncomingHandler) => {
			assert.deepStrictEqual(nexus.mode, mode);
			assert.deepStrictEqual(nexus.operation, operation);
			assert.notDeepStrictEqual(nexus.regExp, undefined);
			handler && assert.deepStrictEqual(nexus.handler, handler);
		};

		mocha.beforeEach(() => {
			server = new Server(createIdentifier());
		});

		mocha.it('should register REPLY execution', () => {
			server.reply('', remoteFunction);
			server.reply('nexus', remoteFunction);
			server.reply('*', remoteFunction);
			validateNexus(server.executions[0] as Nexus, 'REPLY', '');
			validateNexus(server.executions[1] as Nexus, 'REPLY', 'nexus');
			validateNexus(server.executions[2] as Nexus, 'REPLY', '*');
			assert.deepStrictEqual(server.executions.length, 3);
		});

		mocha.it('should register CONDUCTOR execution', () => {
			server.conductor('', remoteFunction);
			server.conductor('nexus', remoteFunction);
			server.conductor('*', remoteFunction);
			validateNexus(server.executions[0] as Nexus, 'CONDUCTOR', '');
			validateNexus(server.executions[1] as Nexus, 'CONDUCTOR', 'nexus');
			validateNexus(server.executions[2] as Nexus, 'CONDUCTOR', '*');
			assert.deepStrictEqual(server.executions.length, 3);
		});

		mocha.it('should register OMNI execution', () => {
			server.omni('', handler);
			server.omni('nexus', handler);
			server.omni('*', handler);
			validateNexus(server.executions[0] as Nexus, 'OMNI', '', handler);
			validateNexus(server.executions[1] as Nexus, 'OMNI', 'nexus', handler);
			validateNexus(server.executions[2] as Nexus, 'OMNI', '*', handler);
			assert.deepStrictEqual(server.executions.length, 3);
		});
	});

	mocha.describe('Attach Test', () => {
		let server: Server;

		const registerNexus = <E extends IExecutor>(executor: E) => {
			executor.reply('nexus1', (...args) => {});
			executor.conductor('nexus2', (conductor, ...args) => {});
			executor.omni('nexus3', (incoming, outgoing, proceed) => {});
		};

		mocha.beforeEach(() => {
			server = new Server(createIdentifier());
		});

		mocha.it('should attach executor', () => {
			const executor1 = new Executor();
			registerNexus(executor1);
			const executor2 = new Executor();
			const executor3 = new Executor();
			registerNexus(executor3);
			server.attach('Segment', executor1);
			server.attach('', executor2);
			server.attach('*', executor3);
			assert.deepStrictEqual((server.executions[0] as Segment).operation, 'Segment');
			assert.notDeepStrictEqual((server.executions[0] as Segment).regExp, undefined);
			assert.deepStrictEqual((server.executions[0] as Segment).executions, executor1.executions);
			assert.deepStrictEqual((server.executions[0] as Segment).executions.length, 3);
			assert.deepStrictEqual((server.executions[1] as Segment).operation, '');
			assert.notDeepStrictEqual((server.executions[1] as Segment).regExp, undefined);
			assert.deepStrictEqual((server.executions[1] as Segment).executions, executor2.executions);
			assert.deepStrictEqual((server.executions[1] as Segment).executions.length, 0);
			assert.deepStrictEqual((server.executions[2] as Segment).operation, '*');
			assert.notDeepStrictEqual((server.executions[2] as Segment).regExp, undefined);
			assert.deepStrictEqual((server.executions[2] as Segment).executions, executor3.executions);
			assert.deepStrictEqual((server.executions[2] as Segment).executions.length, 3);
			assert.deepStrictEqual(server.executions.length, 3);
		});
	});

	mocha.describe('Dispatch Test', () => {
		let proceedCalled: number;
		let server: Server;
		let client: Client;

		const errorFunction = (...args: Array<any>) => {
			throw new Error('Should not be called');
		};
		const proceedHandler: IncomingHandler = (incoming, outgoing, proceed) => {
			proceedCalled++;
			proceed();
		};
		const errorHandler: IncomingHandler = (incoming, outgoing, proceed) => {
			throw new Error('Should not be called');
		};

		mocha.beforeEach(async () => {
			proceedCalled = 0;
			server = new Server(createIdentifier());
			server.listen(port);
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

		mocha.it('should dispatch I/O to REPLY execution', async () => {
			// Server
			server.omni('*', proceedHandler);
			server.reply('nexus', (arg) => {
				assert.deepStrictEqual(proceedCalled, 1);
				return arg;
			});
			server.conductor('nexus', errorFunction);

			// Client
			const outgoingData = createString(1000);
			const incomingData = await client.message('nexus', outgoingData);
			assert.deepStrictEqual(incomingData, outgoingData);
		});

		mocha.it('should dispatch I/O to CONDUCTOR execution', async () => {
			// Server
			server.omni('*', proceedHandler);
			server.reply('nexus1', errorFunction);
			server.conductor('nexus1', async (conductor, arg) => {
				assert.deepStrictEqual(proceedCalled, 1);
				await once(conductor, 'end');
				await conductor.end();
				return;
			});
			server.conductor('nexus2', async (conductor, arg) => {
				assert.deepStrictEqual(proceedCalled, 2);
				await once(conductor, 'end');
				await conductor.end();
				return;
			});

			// Client
			const outgoingData = createString(1000);
			const orchestrator = new Orchestrator();
			await client.conduct('nexus1', orchestrator, outgoingData);
			await client.conduct('nexus2', orchestrator, outgoingData);
			await orchestrator.end();
		});

		mocha.it('should dispatch I/O to execution with wildcard operation', async () => {
			// Server
			server.omni('nex*1*3', proceedHandler);
			server.omni('nex*3', proceedHandler);
			server.omni('n*3', proceedHandler);
			server.omni('*', (incoming, outgoing, proceed) => {
				assert.deepStrictEqual(proceedCalled, 3);
				incoming.pipe(outgoing);
			});

			// Client
			const outgoingData = createString(1000);
			const { incoming, data: incomingData } = await clientIO(client, 'REPLY', 'nexus123', outgoingData);
			assert.deepStrictEqual(incoming.mode, 'REPLY');
			assert.deepStrictEqual(incoming.operation, 'nexus123');
			assert.deepStrictEqual(incoming.parameters['SID'], server.identifier);
			assert.deepStrictEqual(incomingData, outgoingData);
		});

		mocha.it('should dispatch I/O to execution with case sensitivity in operation', async () => {
			// Server
			server.omni('NEXUS', errorHandler);
			server.omni('nexus', (incoming, outgoing, proceed) => {
				incoming.pipe(outgoing);
			});

			// Client
			const outgoingData = createString(1000);
			const { incoming, data: incomingData } = await clientIO(client, 'REPLY', 'nexus', outgoingData);
			assert.deepStrictEqual(incoming.mode, 'REPLY');
			assert.deepStrictEqual(incoming.operation, 'nexus');
			assert.deepStrictEqual(incoming.parameters['SID'], server.identifier);
			assert.deepStrictEqual(incomingData, outgoingData);
		});

		mocha.it('should dispatch I/O to execution with registration order', async () => {
			// Server
			server.omni('nexus', proceedHandler);
			server.omni('nexus', (incoming, outgoing, proceed) => {
				assert.deepStrictEqual(proceedCalled, 1);
				incoming.pipe(outgoing);
			});
			server.omni('nexus', errorHandler);

			// Client
			const outgoingData = createString(1000);
			const { incoming, data: incomingData } = await clientIO(client, 'REPLY', 'nexus', outgoingData);
			assert.deepStrictEqual(incoming.mode, 'REPLY');
			assert.deepStrictEqual(incoming.operation, 'nexus');
			assert.deepStrictEqual(incoming.parameters['SID'], server.identifier);
			assert.deepStrictEqual(incomingData, outgoingData);
		});

		mocha.it('should dispatch I/O to executor attached', async () => {
			// Server
			const executor1 = new Executor();
			executor1.omni('*', proceedHandler);
			const executor2 = new Executor();
			executor2.omni('*', errorHandler);
			const executor3 = new Executor();
			executor3.omni('*', proceedHandler);
			executor3.omni('nexus', (incoming, outgoing, proceed) => {
				assert.deepStrictEqual(proceedCalled, 2);
				incoming.pipe(outgoing);
			});
			const executor4 = new Executor();
			server.attach('*', executor1);
			server.attach('Segment2', executor2);
			server.attach('Segment3', executor3);
			server.attach('Segment4', executor4);

			// Client
			const outgoingData = createString(1000);
			const { incoming, data: incomingData } = await clientIO(client, 'REPLY', 'Segment3.nexus', outgoingData);
			assert.deepStrictEqual(incoming.mode, 'REPLY');
			assert.deepStrictEqual(incoming.operation, 'Segment3.nexus');
			assert.deepStrictEqual(incoming.parameters['SID'], server.identifier);
			assert.deepStrictEqual(incomingData, outgoingData);
		});

		mocha.it('should dispatch I/O through executions & executors', async () => {
			// Server
			const executor1 = new Executor();
			executor1.omni('*', proceedHandler);
			const executor2 = new Executor();
			executor2.omni('*', errorHandler);
			const executor3 = new Executor();
			executor3.omni('*', proceedHandler);
			executor3.omni('nexus', (incoming, outgoing, proceed) => {
				assert.deepStrictEqual(proceedCalled, 2);
				incoming.pipe(outgoing);
			});
			const executor4 = new Executor();
			server.omni('*', proceedHandler);
			server.omni('nexus1', errorHandler);
			server.omni('*1', errorHandler);
			server.omni('nex*', proceedHandler);
			server.omni('nexus2', (incoming, outgoing, proceed) => {
				assert.deepStrictEqual(proceedCalled, 2);
				incoming.pipe(outgoing);
			});
			server.omni('nexus3', errorHandler);
			server.attach('*', executor1);
			server.attach('Segment2', executor2);
			server.attach('Segment3', executor3);
			server.attach('Segment4', executor4);
			server.omni('nexus3', errorHandler);

			// Client 1
			const outgoingData1 = createString(1000);
			const { incoming: incoming1, data: incomingData1 } = await clientIO(client, 'REPLY', 'nexus2', outgoingData1);
			assert.deepStrictEqual(incoming1.mode, 'REPLY');
			assert.deepStrictEqual(incoming1.operation, 'nexus2');
			assert.deepStrictEqual(incoming1.parameters['SID'], server.identifier);
			assert.deepStrictEqual(incomingData1, outgoingData1);

			// Rest
			proceedCalled = 0;

			// Client 2
			const outgoingData2 = createString(1000);
			const { incoming: incoming2, data: incomingData2 } = await clientIO(client, 'REPLY', 'Segment3.nexus', outgoingData2);
			assert.deepStrictEqual(incoming2.mode, 'REPLY');
			assert.deepStrictEqual(incoming2.operation, 'Segment3.nexus');
			assert.deepStrictEqual(incoming2.parameters['SID'], server.identifier);
			assert.deepStrictEqual(incomingData2, outgoingData2);
		});
	});

	mocha.describe('Handler Function Test', () => {
		let server: Server;
		let client: Client;

		const args = [null, 0, '', {}, [], [null], [0], [''], [{}], [[]], createString(1000), { arg: createString(1000) }, createString(1000).split('')];

		const conduct = (conductor: Conductor) => {
			conductor.on('signal', (event: string, tags: Tags) => conductor.signal(event, tags));
			conductor.on('payload', async () => conductor.deliver(await read(conductor)));
			conductor.on('end', () => conductor.end());
		};

		const orchestrate = async (orchestrator: Orchestrator, iterations: number, signals: number, payloads: number) => {
			for (let i = 0; i < iterations; i++) {
				for (let j = 0; j < signals; j++) {
					// Signals
					const signal = new Signal(createString(10), { ID: createString(5) });
					const returnedSignals = await orchestrator.signal(signal.event, signal.tags); // Write + Read
					returnedSignals.forEach((returnedSignal) => {
						assert.deepStrictEqual(returnedSignal.event, signal.event);
						assert.deepStrictEqual(returnedSignal.tags, signal.tags);
					});
				}
				for (let j = 0; j < payloads; j++) {
					// Payloads
					await Promise.all(
						orchestrator.conductors.map(async (conductor) => {
							const data = createString(20);
							await conductor.deliver(data); // Write
							await once(conductor, 'payload');
							const returnedData = await read(conductor); // Read
							assert.deepStrictEqual(returnedData, data);
						})
					);
				}
			}
		};

		mocha.beforeEach(async () => {
			server = new Server(createIdentifier());
			server.listen(port);
			await once(server, 'listening');

			client = new Client(createIdentifier(), { maxPoolSize: 30 });
			client.connect(port, host);
			await once(client, 'connect');
		});

		mocha.afterEach(async () => {
			client.close();
			await once(client, 'close');

			server.close();
			await once(server, 'close');
		});

		mocha.it('should send a message and expect an empty reply', async () => {
			// Server
			server.reply('nexus', (arg) => {
				assert.deepStrictEqual(arg, undefined);
				return;
			});

			// Client
			const returned = await client.message('nexus');
			assert.deepStrictEqual(returned, {});
		});

		mocha.it('should send a message and expect an object reply', async () => {
			// Server
			server.reply('nexus', (arg) => {
				return arg;
			});

			// Client
			const returned = new Array();
			for await (const arg of args) {
				const reply = await client.message('nexus', arg);
				returned.push(reply);
			}
			assert.deepStrictEqual(returned, args);
		});

		mocha.it('should send a message and expect an ...object reply', async () => {
			// Server
			server.reply('nexus', (...args) => {
				return args;
			});

			// Client
			const returned = await client.message('nexus', ...args);
			assert.deepStrictEqual(returned, args);
		});

		mocha.it('should send a message and expect an error reply', async () => {
			// Server
			server.reply('nexus', (arg) => {
				throw new Error(arg);
			});

			// Client
			try {
				const returned = await client.message('nexus', 'SCP Error');
			} catch (error) {
				assert.deepStrictEqual((error as Error).message, 'SCP Error');
			}
		});

		mocha.it('should send a message and orchestrate in sequence', async () => {
			const operations = Array(20)
				.fill({})
				.map(() => createString(5));

			// Server
			server.conductor('*', (conductor, ..._args) => {
				assert.deepStrictEqual(_args, args);
				conduct(conductor);
				return;
			});

			// Client
			const orchestrator = new Orchestrator();
			for await (const operation of operations) {
				await client.conduct(operation, orchestrator, ...args);
			}
			await orchestrate(orchestrator, 5, 5, 5);
			await orchestrator.end();
		});

		mocha.it('should send a message and orchestrate in parallel', async () => {
			const operations = Array(20)
				.fill({})
				.map(() => createString(5));

			// Server
			server.conductor('*', (conductor, ..._args) => {
				assert.deepStrictEqual(_args, args);
				conduct(conductor);
				return;
			});

			// Client
			const orchestrator = new Orchestrator();
			await Promise.all(
				operations.map(async (operation) => {
					await client.conduct(operation, orchestrator, ...args);
				})
			);
			await orchestrate(orchestrator, 5, 5, 5);
			await orchestrator.end();
		});
	});

	mocha.describe('Pool Test', () => {
		let server: Server;
		let pool: { create: 0; acquire: 0; drain: 0 };
		let poolSocket: { drain: 0 };

		const createClient = async (options: ClientOptions) => {
			pool = { create: 0, acquire: 0, drain: 0 };
			poolSocket = { drain: 0 };
			const client = new Client(createIdentifier(), options);
			client.on('pool:create', (socket: Socket) => {
				assert.notDeepStrictEqual(socket, undefined);
				pool.create++;
				socket.on('io:drain', () => poolSocket.drain++);
			});
			client.on('pool:acquire', (socket: Socket) => {
				assert.notDeepStrictEqual(socket, undefined);
				pool.acquire++;
			});
			client.on('pool:drain', () => pool.drain++);
			client.connect(port, host);
			await once(client, 'connect');
			return client;
		};

		mocha.beforeEach(async () => {
			server = new Server(createIdentifier());
			server.reply('nexus', (arg) => arg);
			server.listen(port);
			await once(server, 'listening');
		});

		mocha.afterEach(async () => {
			server.close();
			await once(server, 'close');
		});

		mocha.it('should reuse sockets up to maxPoolSize', async () => {
			const messages = Array(100)
				.fill({})
				.map((_) => createString(10000));

			// Client
			const client = await createClient({ maxPoolSize: 2, maxMessages: Infinity, idleTimeout: 0 });
			const returned = await Promise.all(messages.map(async (message) => client.message('nexus', message)));
			assert.deepStrictEqual(returned, messages);
			assert.deepStrictEqual(client.pool, { size: 2, busy: 1, idle: 1 });
			assert.deepStrictEqual(pool, { create: 2, acquire: 100, drain: 0 });
			assert.deepStrictEqual(poolSocket, { drain: 2 });
		});

		mocha.it('should reuse sockets up to maxMessages', async () => {
			const messages = Array(100)
				.fill({})
				.map((_) => createString(10000));

			// Client
			const client = await createClient({ maxPoolSize: 2, maxMessages: 100, idleTimeout: 0 });
			const returned = await Promise.all(messages.map(async (message) => client.message('nexus', message)));
			assert.deepStrictEqual(returned, messages);
			assert.deepStrictEqual(client.pool, { size: 1, busy: 1, idle: 0 });
			assert.deepStrictEqual(pool, { create: 2, acquire: 100, drain: 1 });
			assert.deepStrictEqual(poolSocket, { drain: 1 });
		});

		mocha.it('should reuse sockets up to idleTimeout', async () => {
			const messages = Array(100)
				.fill({})
				.map((_) => createString(10000));

			// Client
			const client = await createClient({ maxPoolSize: 2, maxMessages: Infinity, idleTimeout: 100 });
			const returned = await Promise.all(messages.map(async (message) => client.message('nexus', message)));
			assert.deepStrictEqual(returned, messages);
			assert.deepStrictEqual(client.pool, { size: 2, busy: 1, idle: 1 });
			assert.deepStrictEqual(pool, { create: 2, acquire: 100, drain: 0 });
			assert.deepStrictEqual(poolSocket, { drain: 2 });
			await promisify(setTimeout)(150);
			assert.deepStrictEqual(client.pool, { size: 1, busy: 1, idle: 0 });
			assert.deepStrictEqual(pool, { create: 2, acquire: 100, drain: 1 });
			assert.deepStrictEqual(poolSocket, { drain: 2 });
		});
	});
});
