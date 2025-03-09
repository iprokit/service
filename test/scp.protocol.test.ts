// Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';
import { promises as Stream, pipeline } from 'stream';
import { Socket as TcpSocket, Server as TcpServer } from 'net';

// Import Local.
import { Frame, RFI, Mode, Signal, Protocol, Incoming, Outgoing } from '../lib/scp';
import { createFrame, createRFI, createData, createSignal, readObjects as read, writeObjects as write } from './util';

const host = '127.0.0.1';
const port = 6000;

mocha.describe('SCP Protocol Test', () => {
	mocha.describe('Creation Frame Test', () => {
		mocha.it('should create a rfi(`rfi`) frame', () => {
			const rfi = 'MODE:Operation#ONE=1&TWO=2&THREE=3';
			const frame = Frame.createRFI(rfi);
			assert.deepStrictEqual(frame.length, Frame.HEAD_BYTES + rfi.length);
			assert.deepStrictEqual(frame.type, Frame.RFI);
			assert.deepStrictEqual(frame.payload, rfi);
			assert.deepStrictEqual(frame.isRFI(), true);
			assert.deepStrictEqual(frame.isData(), false);
			assert.deepStrictEqual(frame.isSignal(), false);
			assert.deepStrictEqual(frame.isEnd(), false);
		});

		mocha.it('should create a rfi(``) frame', () => {
			const frame = Frame.createRFI(``);
			assert.deepStrictEqual(frame.length, Frame.HEAD_BYTES);
			assert.deepStrictEqual(frame.type, Frame.RFI);
			assert.deepStrictEqual(frame.payload, ``);
			assert.deepStrictEqual(frame.isRFI(), true);
			assert.deepStrictEqual(frame.isData(), false);
			assert.deepStrictEqual(frame.isSignal(), false);
			assert.deepStrictEqual(frame.isEnd(), false);
		});

		mocha.it('should create a data(`data`) frame', () => {
			const data = 'Data';
			const frame = Frame.createData(data);
			assert.deepStrictEqual(frame.length, Frame.HEAD_BYTES + data.length);
			assert.deepStrictEqual(frame.type, Frame.DATA);
			assert.deepStrictEqual(frame.payload, data);
			assert.deepStrictEqual(frame.isRFI(), false);
			assert.deepStrictEqual(frame.isData(), true);
			assert.deepStrictEqual(frame.isSignal(), false);
			assert.deepStrictEqual(frame.isEnd(), false);
		});

		mocha.it('should create a data(``) frame', () => {
			const frame = Frame.createData(``);
			assert.deepStrictEqual(frame.length, Frame.HEAD_BYTES);
			assert.deepStrictEqual(frame.type, Frame.DATA);
			assert.deepStrictEqual(frame.payload, ``);
			assert.deepStrictEqual(frame.isRFI(), false);
			assert.deepStrictEqual(frame.isData(), true);
			assert.deepStrictEqual(frame.isSignal(), false);
			assert.deepStrictEqual(frame.isEnd(), false);
		});

		mocha.it('should create a data() frame', () => {
			const frame = Frame.createData();
			assert.deepStrictEqual(frame.length, Frame.HEAD_BYTES);
			assert.deepStrictEqual(frame.type, Frame.DATA);
			assert.deepStrictEqual(frame.payload, undefined);
			assert.deepStrictEqual(frame.isRFI(), false);
			assert.deepStrictEqual(frame.isData(), true);
			assert.deepStrictEqual(frame.isSignal(), false);
			assert.deepStrictEqual(frame.isEnd(), false);
		});

		mocha.it('should create a signal(`signal`) frame', () => {
			const signal = 'SIGNAL%ONE=1&TWO=2&THREE=3';
			const frame = Frame.createSignal(signal);
			assert.deepStrictEqual(frame.length, Frame.HEAD_BYTES + signal.length);
			assert.deepStrictEqual(frame.type, Frame.SIGNAL);
			assert.deepStrictEqual(frame.payload, signal);
			assert.deepStrictEqual(frame.isRFI(), false);
			assert.deepStrictEqual(frame.isData(), false);
			assert.deepStrictEqual(frame.isSignal(), true);
			assert.deepStrictEqual(frame.isEnd(), false);
		});

		mocha.it('should create a signal(``) frame', () => {
			const frame = Frame.createSignal(``);
			assert.deepStrictEqual(frame.length, Frame.HEAD_BYTES);
			assert.deepStrictEqual(frame.type, Frame.SIGNAL);
			assert.deepStrictEqual(frame.payload, ``);
			assert.deepStrictEqual(frame.isRFI(), false);
			assert.deepStrictEqual(frame.isData(), false);
			assert.deepStrictEqual(frame.isSignal(), true);
			assert.deepStrictEqual(frame.isEnd(), false);
		});

		mocha.it('should create a end frame', () => {
			const frame = Frame.createEnd();
			assert.deepStrictEqual(frame.length, Frame.HEAD_BYTES);
			assert.deepStrictEqual(frame.type, Frame.END);
			assert.deepStrictEqual(frame.payload, undefined);
			assert.deepStrictEqual(frame.isRFI(), false);
			assert.deepStrictEqual(frame.isData(), false);
			assert.deepStrictEqual(frame.isSignal(), false);
			assert.deepStrictEqual(frame.isEnd(), true);
		});
	});

	mocha.describe('Constructor RFI Test', () => {
		mocha.it('should construct rfi with default variables', () => {
			const _rfi = 'MODE:Operation';
			const rfi = new RFI('MODE' as Mode, 'Operation');
			assert.deepStrictEqual(rfi.mode, 'MODE');
			assert.deepStrictEqual(rfi.operation, 'Operation');
			assert.deepStrictEqual(rfi.parameters, {});
			assert.deepStrictEqual(rfi.size, 0);
			assert.deepStrictEqual(rfi.stringify(), _rfi);
			assert.deepStrictEqual(rfi, RFI.objectify(_rfi));
		});

		mocha.it('should construct rfi with custom(mode) variables', () => {
			const _rfi = ':Operation';
			const rfi = new RFI('' as Mode, 'Operation');
			assert.deepStrictEqual(rfi.mode, '');
			assert.deepStrictEqual(rfi.operation, 'Operation');
			assert.deepStrictEqual(rfi.parameters, {});
			assert.deepStrictEqual(rfi.size, 0);
			assert.deepStrictEqual(rfi.stringify(), _rfi);
			assert.deepStrictEqual(rfi, RFI.objectify(_rfi));
		});

		mocha.it('should construct rfi with custom(operation) variables', () => {
			const _rfi = 'MODE:';
			const rfi = new RFI('MODE' as Mode, '');
			assert.deepStrictEqual(rfi.mode, 'MODE');
			assert.deepStrictEqual(rfi.operation, '');
			assert.deepStrictEqual(rfi.parameters, {});
			assert.deepStrictEqual(rfi.size, 0);
			assert.deepStrictEqual(rfi.stringify(), _rfi);
			assert.deepStrictEqual(rfi, RFI.objectify(_rfi));
		});

		mocha.it('should construct rfi with custom(parameters 1) variables', () => {
			const _rfi = 'MODE:Operation';
			const rfi = new RFI('MODE' as Mode, 'Operation', {});
			assert.deepStrictEqual(rfi.mode, 'MODE');
			assert.deepStrictEqual(rfi.operation, 'Operation');
			assert.deepStrictEqual(rfi.parameters, {});
			assert.deepStrictEqual(rfi.size, 0);
			assert.deepStrictEqual(rfi.stringify(), _rfi);
			assert.deepStrictEqual(rfi, RFI.objectify(_rfi));
		});

		mocha.it('should construct rfi with custom(parameters 2) variables', () => {
			const _rfi = 'MODE:Operation#ONE=';
			const rfi = new RFI('MODE' as Mode, 'Operation', { ONE: '' });
			assert.deepStrictEqual(rfi.mode, 'MODE');
			assert.deepStrictEqual(rfi.operation, 'Operation');
			assert.deepStrictEqual(rfi.parameters, { ONE: '' });
			assert.deepStrictEqual(rfi.get('ONE'), '');
			assert.deepStrictEqual(rfi.size, 1);
			assert.deepStrictEqual(rfi.stringify(), _rfi);
			assert.deepStrictEqual(rfi, RFI.objectify(_rfi));
		});

		mocha.it('should construct rfi with custom(parameters 3) variables', () => {
			const _rfi = 'MODE:Operation#ONE=&TWO=2&THREE=3';
			const rfi = new RFI('MODE' as Mode, 'Operation', { ONE: '', TWO: '', THREE: '3' });
			rfi.set('TWO', '2');
			assert.deepStrictEqual(rfi.mode, 'MODE');
			assert.deepStrictEqual(rfi.operation, 'Operation');
			assert.deepStrictEqual(rfi.parameters, { ONE: '', TWO: '2', THREE: '3' });
			assert.deepStrictEqual(rfi.get('ONE'), '');
			assert.deepStrictEqual(rfi.has('TWO'), true);
			assert.deepStrictEqual(rfi.get('THREE'), '3');
			assert.deepStrictEqual(rfi.has('ZERO'), false);
			assert.deepStrictEqual(rfi.size, 3);
			assert.deepStrictEqual(rfi.stringify(), _rfi);
			assert.deepStrictEqual(rfi, RFI.objectify(_rfi));
		});
	});

	mocha.describe('Constructor Signal Test', () => {
		mocha.it('should construct signal with default variables', () => {
			const _signal = 'SIGNAL';
			const signal = new Signal('SIGNAL');
			assert.deepStrictEqual(signal.event, 'SIGNAL');
			assert.deepStrictEqual(signal.tags, {});
			assert.deepStrictEqual(signal.size, 0);
			assert.deepStrictEqual(signal.stringify(), _signal);
			assert.deepStrictEqual(signal, Signal.objectify(_signal));
		});

		mocha.it('should construct signal with custom(tags 1) variables', () => {
			const _signal = 'SIGNAL';
			const signal = new Signal('SIGNAL', {});
			assert.deepStrictEqual(signal.event, 'SIGNAL');
			assert.deepStrictEqual(signal.tags, {});
			assert.deepStrictEqual(signal.size, 0);
			assert.deepStrictEqual(signal.stringify(), _signal);
			assert.deepStrictEqual(signal, Signal.objectify(_signal));
		});

		mocha.it('should construct signal with custom(tags 2) variables', () => {
			const _signal = 'SIGNAL%ONE=';
			const signal = new Signal('SIGNAL', { ONE: '' });
			assert.deepStrictEqual(signal.event, 'SIGNAL');
			assert.deepStrictEqual(signal.tags, { ONE: '' });
			assert.deepStrictEqual(signal.get('ONE'), '');
			assert.deepStrictEqual(signal.size, 1);
			assert.deepStrictEqual(signal.stringify(), _signal);
			assert.deepStrictEqual(signal, Signal.objectify(_signal));
		});

		mocha.it('should construct signal with custom(tags 3) variables', () => {
			const _signal = 'SIGNAL%ONE=&TWO=2&THREE=3';
			const signal = new Signal('SIGNAL', { ONE: '', TWO: '', THREE: '3' });
			signal.set('TWO', '2');
			assert.deepStrictEqual(signal.event, 'SIGNAL');
			assert.deepStrictEqual(signal.tags, { ONE: '', TWO: '2', THREE: '3' });
			assert.deepStrictEqual(signal.get('ONE'), '');
			assert.deepStrictEqual(signal.has('TWO'), true);
			assert.deepStrictEqual(signal.get('THREE'), '3');
			assert.deepStrictEqual(signal.has('ZERO'), false);
			assert.deepStrictEqual(signal.size, 3);
			assert.deepStrictEqual(signal.stringify(), _signal);
			assert.deepStrictEqual(signal, Signal.objectify(_signal));
		});
	});

	mocha.describe('Constructor Base Test', () => {
		mocha.it('should construct protocol', () => {
			const socket = new TcpSocket();
			const protocol = new Protocol(socket);
			assert.deepStrictEqual(protocol.socket, socket);
		});
	});

	mocha.describe('Connection Test', () => {
		let server: TcpServer;

		mocha.beforeEach(async () => {
			server = new TcpServer();
			server.listen(port);
			await once(server, 'listening');
		});

		mocha.afterEach(async () => {
			server.close();
			await once(server, 'close');
		});

		mocha.it('should emit connect, end & close events', async () => {
			// Server
			server.on('connection', async (socket: TcpSocket) => {
				const connection = new Protocol(socket);
				connection.pipe(connection);
			});

			// Client
			const protocol = new Protocol(new TcpSocket());
			protocol.socket.connect(port, host);
			await once(protocol.socket, 'connect');
			protocol.end(); // Write
			protocol.resume(); // Read
			await Stream.finished(protocol);
		});
	});

	mocha.describe('RAW: Read & Write Test', () => {
		let protocol: Protocol;
		let server: TcpServer;

		mocha.beforeEach(async () => {
			server = new TcpServer();
			server.on('connection', (socket: TcpSocket) => {
				const connection = new Protocol(socket);
				connection.pipe(connection);
			});
			server.listen(port);
			await once(server, 'listening');

			protocol = new Protocol(new TcpSocket());
			protocol.socket.connect(port, host);
			await once(protocol.socket, 'connect');
		});

		mocha.afterEach(async () => {
			server.close();
			await once(server, 'close');
		});

		mocha.it('should read & write single frame', async () => {
			const frames = Array(createFrame());

			// Client
			await write(protocol, frames, false);
			const framesReceived = (await read(protocol)) as Array<Frame>;
			assert.deepStrictEqual(framesReceived, frames);
		});

		mocha.it('should read & write multiple frames', async () => {
			const frames = Array(20)
				.fill({})
				.map(() => createFrame());

			// Client
			await write(protocol, frames, false);
			const framesReceived = (await read(protocol)) as Array<Frame>;
			assert.deepStrictEqual(framesReceived, frames);
		});

		mocha.it('should throw FRAME_TOO_LARGE', async () => {
			const frames = Array(createFrame(Frame.PAYLOAD_BYTES * 2));

			// Client
			await assert.rejects(async () => {
				await write(protocol, frames, false);
			}, /FRAME_TOO_LARGE/);
		});
	});

	mocha.describe('SINGLE IO: Read & Write Test', () => {
		let protocol: Protocol;
		let server: TcpServer;

		const processIO = (connection: Protocol) => {
			const incoming = new Incoming(connection);
			incoming.once('rfi', () => {
				const outgoing = new Outgoing(connection);
				outgoing.setRFI(incoming.mode, incoming.operation, incoming.parameters);
				pipeline(incoming, outgoing, (error) => {
					if (error) return;
				});
			});
		};

		mocha.beforeEach(async () => {
			server = new TcpServer();
			server.on('connection', (socket: TcpSocket) => {
				const connection = new Protocol(socket);
				processIO(connection);
				connection.once('end', () => connection.end());
			});
			server.listen(port);
			await once(server, 'listening');

			protocol = new Protocol(new TcpSocket());
			protocol.socket.connect(port, host);
			await once(protocol.socket, 'connect');
		});

		mocha.afterEach(async () => {
			protocol.resume().end(); // Trigger read + end.
			await once(protocol, 'close');

			server.close();
			await once(server, 'close');
		});

		mocha.it('should end() with end & close events', async () => {
			const { mode, operation, parameters } = createRFI();
			const data = Array();

			// Client
			const outgoing = new Outgoing(protocol);
			outgoing.setRFI(mode, operation, parameters); // Prepare Write
			await write(outgoing, data, true);
		});

		mocha.it('should read & write empty frame(data)', async () => {
			const rfi = createRFI();
			const data = Array('');

			// Client
			const outgoing = new Outgoing(protocol);
			outgoing.setRFI(rfi.mode, rfi.operation, rfi.parameters); // Prepare Write
			await write(outgoing, data, true);
			const incoming = new Incoming(protocol);
			await once(incoming, 'rfi'); // Prepare Read
			const dataReceived = (await read(incoming)) as Array<string | Signal>;
			assert.deepStrictEqual(incoming.rfi, rfi);
			assert.deepStrictEqual(dataReceived, data);
		});

		mocha.it('should read & write single frame(data & signal)', async () => {
			const rfi = createRFI();
			const data = Array<string | Signal>(createData(), createSignal());

			// Client
			const outgoing = new Outgoing(protocol);
			outgoing.setRFI(rfi.mode, rfi.operation, rfi.parameters); // Prepare Write
			await write(outgoing, data, true);
			const incoming = new Incoming(protocol);
			await once(incoming, 'rfi'); // Prepare Read
			const dataReceived = (await read(incoming)) as Array<string | Signal>;
			assert.deepStrictEqual(incoming.rfi, rfi);
			assert.deepStrictEqual(dataReceived, data);
		});

		mocha.it('should read & write multiple frames(data & signal)', async () => {
			const rfi = createRFI();
			const data = Array(20)
				.fill({})
				.map((_, index) => (index % 2 === 0 ? createData() : createSignal()));

			// Client
			const outgoing = new Outgoing(protocol);
			outgoing.setRFI(rfi.mode, rfi.operation, rfi.parameters); // Prepare Write
			await write(outgoing, data, true);
			const incoming = new Incoming(protocol);
			await once(incoming, 'rfi'); // Prepare Read
			const dataReceived = (await read(incoming)) as Array<string | Signal>;
			assert.deepStrictEqual(incoming.rfi, rfi);
			assert.deepStrictEqual(dataReceived, data);
		});

		mocha.it('should throw RFI_NOT_SET', async () => {
			const data = Array(createData());

			// Client
			await assert.rejects(async () => {
				const outgoing = new Outgoing(protocol);
				await write(outgoing, data, true);
			}, /RFI_NOT_SET/);
		});
	});

	mocha.describe('MULTIPLE IO: Read & Write Test', () => {
		let protocol: Protocol;
		let server: TcpServer;

		const processIO = (connection: Protocol) => {
			const incoming = new Incoming(connection);
			incoming.once('rfi', () => {
				const outgoing = new Outgoing(connection);
				outgoing.setRFI(incoming.mode, incoming.operation, incoming.parameters);
				pipeline(incoming, outgoing, (error) => {
					if (error) return;
					processIO(connection);
				});
			});
		};

		mocha.beforeEach(async () => {
			server = new TcpServer();
			server.on('connection', (socket: TcpSocket) => {
				const connection = new Protocol(socket);
				processIO(connection);
				connection.once('end', () => connection.end());
			});
			server.listen(port);
			await once(server, 'listening');

			protocol = new Protocol(new TcpSocket());
			protocol.socket.connect(port, host);
			await once(protocol.socket, 'connect');
		});

		mocha.afterEach(async () => {
			protocol.resume().end(); // Trigger read + end.
			await once(protocol, 'close');

			server.close();
			await once(server, 'close');
		});

		mocha.it('should end() with end & close events', async () => {
			const streams = Array(20)
				.fill({})
				.map(() => ({ rfi: createRFI(), data: Array() }));

			// Client
			for await (const { rfi, data } of streams) {
				const outgoing = new Outgoing(protocol);
				outgoing.setRFI(rfi.mode, rfi.operation, rfi.parameters); // Prepare Write
				await write(outgoing, data, true);
			}
		});

		mocha.it('should read & write empty frame(data)', async () => {
			const streams = Array(20)
				.fill({})
				.map(() => ({ rfi: createRFI(), data: Array('') }));

			// Client
			for await (const { rfi, data } of streams) {
				const outgoing = new Outgoing(protocol);
				outgoing.setRFI(rfi.mode, rfi.operation, rfi.parameters); // Prepare Write
				await write(outgoing, data, true);
				const incoming = new Incoming(protocol);
				await once(incoming, 'rfi'); // Prepare Read
				const dataReceived = (await read(incoming)) as Array<string | Signal>;
				assert.deepStrictEqual(incoming.rfi, rfi);
				assert.deepStrictEqual(dataReceived, data);
			}
		});

		mocha.it('should read & write single frame(data & signal)', async () => {
			const streams = Array(20)
				.fill({})
				.map(() => ({ rfi: createRFI(), data: Array<string | Signal>(createData(), createSignal()) }));

			// Client
			for await (const { rfi, data } of streams) {
				const outgoing = new Outgoing(protocol);
				outgoing.setRFI(rfi.mode, rfi.operation, rfi.parameters); // Prepare Write
				await write(outgoing, data, true);
				const incoming = new Incoming(protocol);
				await once(incoming, 'rfi'); // Prepare Read
				const dataReceived = (await read(incoming)) as Array<string | Signal>;
				assert.deepStrictEqual(incoming.rfi, rfi);
				assert.deepStrictEqual(dataReceived, data);
			}
		});

		mocha.it('should read & write multiple frames(data & signal)', async () => {
			const streams = Array(20)
				.fill({})
				.map(() => ({
					rfi: createRFI(),
					data: Array(20)
						.fill({})
						.map((_, index) => (index % 2 === 0 ? createData() : createSignal()))
				}));

			// Client
			for await (const { rfi, data } of streams) {
				const outgoing = new Outgoing(protocol);
				outgoing.setRFI(rfi.mode, rfi.operation, rfi.parameters); // Prepare Write
				await write(outgoing, data, true);
				const incoming = new Incoming(protocol);
				await once(incoming, 'rfi'); // Prepare Read
				const dataReceived = (await read(incoming)) as Array<string | Signal>;
				assert.deepStrictEqual(incoming.rfi, rfi);
				assert.deepStrictEqual(dataReceived, data);
			}
		});

		mocha.it('should throw RFI_NOT_SET', async () => {
			const streams = Array(20)
				.fill({})
				.map(() => ({ data: Array(createData()) }));

			// Client
			for await (const { data } of streams) {
				await assert.rejects(async () => {
					const outgoing = new Outgoing(protocol);
					await write(outgoing, data, true);
				}, /RFI_NOT_SET/);
			}
		});
	});
});
