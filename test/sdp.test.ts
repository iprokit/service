// Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';

// Import Local.
import { Pod, Attributes, Server } from '../lib/sdp';
import { createIdentifier } from './util';

const port = 5000;
const address = '224.0.0.2';

mocha.describe('SDP Test', () => {
	mocha.describe('Constructor Pod Test', () => {
		mocha.it('should construct pod with default variables', () => {
			const _pod = 'ID*true';
			const pod = new Pod('ID', true);
			assert.deepStrictEqual(pod.identifier, 'ID');
			assert.deepStrictEqual(pod.available, true);
			assert.deepStrictEqual(pod.attributes, {});
			assert.deepStrictEqual(pod.size, 0);
			assert.deepStrictEqual(pod.stringify(), _pod);
			assert.deepStrictEqual(pod, Pod.objectify(_pod));
		});

		mocha.it('should construct pod with custom(attributes 1) variables', () => {
			const _pod = 'ID*false';
			const pod = new Pod('ID', false, {});
			assert.deepStrictEqual(pod.identifier, 'ID');
			assert.deepStrictEqual(pod.available, false);
			assert.deepStrictEqual(pod.attributes, {});
			assert.deepStrictEqual(pod.size, 0);
			assert.deepStrictEqual(pod.stringify(), _pod);
			assert.deepStrictEqual(pod, Pod.objectify(_pod));
		});

		mocha.it('should construct pod with custom(attributes 2) variables', () => {
			const _pod = 'ID*true$ONE=';
			const pod = new Pod('ID', true, { ONE: '' });
			assert.deepStrictEqual(pod.identifier, 'ID');
			assert.deepStrictEqual(pod.available, true);
			assert.deepStrictEqual(pod.attributes, { ONE: '' });
			assert.deepStrictEqual(pod.get('ONE'), '');
			assert.deepStrictEqual(pod.size, 1);
			assert.deepStrictEqual(pod.stringify(), _pod);
			assert.deepStrictEqual(pod, Pod.objectify(_pod));
		});

		mocha.it('should construct pod with custom(attributes 3) variables', () => {
			const _pod = 'ID*false$ONE=&TWO=2&THREE=3';
			const pod = new Pod('ID', false, { ONE: '', TWO: '', THREE: '3' });
			pod.set('TWO', '2');
			assert.deepStrictEqual(pod.identifier, 'ID');
			assert.deepStrictEqual(pod.available, false);
			assert.deepStrictEqual(pod.attributes, { ONE: '', TWO: '2', THREE: '3' });
			assert.deepStrictEqual(pod.get('ONE'), '');
			assert.deepStrictEqual(pod.has('TWO'), true);
			assert.deepStrictEqual(pod.get('THREE'), '3');
			assert.deepStrictEqual(pod.has('ZERO'), false);
			assert.deepStrictEqual(pod.size, 3);
			assert.deepStrictEqual(pod.stringify(), _pod);
			assert.deepStrictEqual(pod, Pod.objectify(_pod));
		});
	});

	mocha.describe('Constructor Base Test', () => {
		mocha.it('should construct server', () => {
			const identifier = createIdentifier();
			const server = new Server(identifier);
			assert.deepStrictEqual(server.identifier, identifier);
			assert.deepStrictEqual(server.attributes, {});
			assert.deepStrictEqual(server.pods, new Map());
		});
	});

	mocha.describe('Connection Test', () => {
		mocha.it('should emit listening & close events', async () => {
			const server = new Server(createIdentifier());
			assert.deepStrictEqual(server.listening, false);
			assert.deepStrictEqual(server.membership, null);
			assert.deepStrictEqual(server.localPort, null);
			assert.deepStrictEqual(server.localAddress, null);
			assert.deepStrictEqual(server.address(), null);
			server.listen(port, address);
			await once(server, 'listening');
			assert.deepStrictEqual(server.listening, true);
			assert.deepStrictEqual(server.membership, address);
			assert.deepStrictEqual(server.localPort, port);
			assert.notDeepStrictEqual(server.localAddress, null);
			assert.deepStrictEqual(server.address()!.port, port);
			server.close();
			await once(server, 'close');
			assert.deepStrictEqual(server.listening, false);
			assert.deepStrictEqual(server.membership, null);
			assert.deepStrictEqual(server.localPort, null);
			assert.deepStrictEqual(server.localAddress, null);
			assert.deepStrictEqual(server.address(), null);
		});
	});

	mocha.describe('Available/Unavailable Test', () => {
		const on = (server: Server, eventName: string, eventCount: number) => {
			return new Promise<Array<{ identifier: string; attributes: Attributes; host: string }>>((resolve, reject) => {
				const pods = new Array<{ identifier: string; attributes: Attributes; host: string }>();
				const listener = (identifier: string, attributes: Attributes, host: string) => {
					pods.push({ identifier, attributes, host });
					if (pods.length === eventCount) {
						server.off(eventName, listener);
						resolve(pods);
					}
				};
				server.on(eventName, listener);
			});
		};

		mocha.it('should emit available & unavailable events', async () => {
			const serverCount = 20;
			const restartCount = 5;
			const identifierB = Array(serverCount)
				.fill({})
				.map(() => createIdentifier());

			// Start A
			const serverA = new Server(createIdentifier());
			serverA.listen(port, address);
			await once(serverA, 'listening');

			for (let i = 0; i < restartCount; i++) {
				const availableSet = new Set<string>(),
					unavailableSet = new Set<string>();

				// Start B
				const serverB = Array(serverCount)
					.fill({})
					.map((_, i) => new Server(identifierB[i]));
				serverB.forEach((server) => server.listen(port, address));
				const availableAB = await Promise.all([on(serverA, 'available', serverCount), ...serverB.map((server) => on(server, 'available', serverCount))]);
				for (const available of availableAB) {
					for (const { identifier, attributes, host } of available) {
						if (!availableSet.has(identifier)) availableSet.add(identifier);
						assert.deepStrictEqual(attributes, {});
						assert.notDeepStrictEqual(host, null);
					}
				}
				assert.deepStrictEqual(availableSet.size, 1 + serverCount); // serverCount = A + B

				// Stop B
				serverB.forEach((server) => server.close());
				const unavailableA = await Promise.all([on(serverA, 'unavailable', serverCount)]);
				for (const unavailable of unavailableA) {
					for (const { identifier, attributes, host } of unavailable) {
						if (!unavailableSet.has(identifier)) unavailableSet.add(identifier);
						assert.deepStrictEqual(attributes, undefined);
						assert.deepStrictEqual(host, undefined);
					}
				}
				assert.deepStrictEqual(unavailableSet.size, serverCount); // serverCount = B

				assert.deepStrictEqual(serverA.pods.size, serverCount);
				serverB.forEach((server) => assert.deepStrictEqual(server.pods.size, serverCount));
			}

			// Stop A
			serverA.close();
			await once(serverA, 'close');
		});
	});
});
