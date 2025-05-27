// Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';

// Import Local.
import Service, { RemoteService, sdp } from '../lib';
import { createIdentifier } from './util';

const httpPort = 3000;
const scpPort = 6000;
const sdpPort = 5000;
const sdpAddress = '224.0.0.2';

mocha.describe('Service Test', () => {
	mocha.describe('Constructor Base Test', () => {
		mocha.it('should construct service', () => {
			const identifier = createIdentifier();
			const service = new Service(identifier);
			assert.deepStrictEqual(service.identifier, identifier);
			assert.deepStrictEqual(service.routes.length, 0);
			assert.deepStrictEqual(service.executions.length, 0);
			assert.deepStrictEqual(service.pods.size, 0);
			assert.deepStrictEqual(service.remoteServices.size, 0);
		});
	});

	mocha.describe('Start/Stop Test', () => {
		mocha.it('should emit start & stop events', async () => {
			let start = 0,
				stop = 0;

			const service = new Service(createIdentifier());
			assert.deepStrictEqual(service.listening, { http: false, scp: false, sdp: false });
			assert.deepStrictEqual(service.address(), { http: null, scp: null, sdp: null });
			assert.deepStrictEqual(service.membership, null);
			assert.deepStrictEqual(service.localAddress, null);
			assert.deepStrictEqual(service.state, 'created');
			service.on('start', () => {
				start++;
				assert.deepStrictEqual(service.listening, { http: true, scp: true, sdp: true });
				assert.deepStrictEqual(service.address().http!.port, httpPort);
				assert.deepStrictEqual(service.address().scp!.port, scpPort);
				assert.deepStrictEqual(service.address().sdp!.port, sdpPort);
				assert.deepStrictEqual(service.membership, sdpAddress);
				assert.notDeepStrictEqual(service.localAddress, null);
				assert.deepStrictEqual(service.state, 'started');
			});
			service.on('stop', () => {
				stop++;
				assert.deepStrictEqual(service.listening, { http: false, scp: false, sdp: false });
				assert.deepStrictEqual(service.address(), { http: null, scp: null, sdp: null });
				assert.deepStrictEqual(service.membership, null);
				assert.deepStrictEqual(service.localAddress, null);
				assert.deepStrictEqual(service.state, 'stopped');
			});
			const started = service.start(httpPort, scpPort, sdpPort, sdpAddress);
			assert.deepStrictEqual(service.state, 'starting');
			await started;
			const stopped = service.stop();
			assert.deepStrictEqual(service.state, 'stopping');
			await stopped;
			assert.deepStrictEqual([start, stop], [1, 1]);
		});
	});

	mocha.describe('Remote Service Test', () => {
		const initService = (identifiers: Array<string>, i: number) => {
			const service = new Service(identifiers[i]);
			identifiers.forEach((identifier, j) => {
				if (i !== j) {
					const remoteService = new RemoteService(identifiers[i]);
					service.link(identifier, remoteService);
				}
			});
			return service;
		};

		const validate = (services: Array<Service>, status: boolean, count: number) => {
			for (const service of services) {
				assert.deepStrictEqual(service.listening, { http: status, scp: status, sdp: status });
				assert.deepStrictEqual(service.remoteServices.size, count - 1);
				service.remoteServices.forEach((remoteService) => {
					assert.deepStrictEqual(remoteService.identifier, service.identifier);
					assert.deepStrictEqual(remoteService.connected, status);
				});
			}
		};

		mocha.it('should link to remote services on start/stop', async () => {
			const serviceCount = 20,
				halfCount = 10;
			const restartCount = 10;
			const identifiers = Array(serviceCount)
				.fill({})
				.map(() => createIdentifier());

			// Initialize
			let half: Array<Service>;
			const services = Array(serviceCount)
				.fill({})
				.map((_, i) => initService(identifiers, i));

			validate(services, false, serviceCount);

			// Start(All)
			await Promise.all([...services.map((service, i) => service.start(httpPort + i, scpPort + i, sdpPort, sdpAddress))]);
			validate(services, true, serviceCount);

			for (let i = 0; i < restartCount; i++) {
				// Stop(Half)
				half = services.slice(0, halfCount);
				await Promise.all([...half.map((service) => service.stop())]);
				validate(half, false, serviceCount);

				// Re-Initialize(Half)
				for (let i = 0; i < halfCount; i++) services[i] = initService(identifiers, i);
				validate(half, false, serviceCount);

				// Start(Half)
				half = services.slice(0, halfCount);
				await Promise.all([...half.map((service, i) => service.start(httpPort + i, scpPort + i, sdpPort, sdpAddress))]);
				validate(half, true, serviceCount);
			}

			// Stop(All)
			await Promise.all([...services.map((service) => service.stop())]);
			validate(services, false, serviceCount);
		});

		mocha.it('should re-link to remote services on non-graceful restart', async () => {
			const identifierA = createIdentifier(),
				identifierB = createIdentifier();

			// Start A + B
			const serviceA = new Service(identifierA);
			serviceA.link(identifierB, new RemoteService(identifierA));
			let serviceB = new Service(identifierB);
			serviceB.link(identifierA, new RemoteService(identifierB));
			await Promise.all([serviceA.start(httpPort, scpPort, sdpPort, sdpAddress), serviceB.start(httpPort + 1, scpPort + 1, sdpPort, sdpAddress)]);

			// Stop B --Force
			const serverB_Symbol = Object.getOwnPropertySymbols(serviceB.sdpServer).find((symbol) => symbol.toString().includes('Socket'));
			const serverB_UDP = (serviceB.sdpServer as any)[serverB_Symbol!];
			serverB_UDP.close();
			serviceB.scpServer.close();
			serviceB.httpServer.close();
			await Promise.all([once(serviceB.httpServer, 'close'), once(serviceB.scpServer, 'close'), once(serverB_UDP, 'close')]);

			const podAB = serviceA.pods.get(identifierB),
				podBA = serviceB.pods.get(identifierA);
			assert.deepStrictEqual(serviceA.remoteServices.get(identifierB)!.connected, false);
			assert.deepStrictEqual(serviceB.remoteServices.get(identifierA)!.connected, true);

			// Start B --Restart
			serviceB = new Service(identifierB);
			serviceB.link(identifierA, new RemoteService(identifierB));
			await serviceB.start(httpPort + 1, scpPort + 1, sdpPort, sdpAddress);

			assert.deepStrictEqual(podAB, { session: sdp.Server.UNAVAILABLE_TOKEN, attributes: null, host: null });
			assert.deepStrictEqual(podBA, serviceB.pods.get(identifierA));
			assert.deepStrictEqual(serviceA.remoteServices.get(identifierB)!.connected, true);
			assert.deepStrictEqual(serviceB.remoteServices.get(identifierA)!.connected, true);

			// Stop A + B
			await serviceA.stop();
			await serviceB.stop();

			assert.notDeepStrictEqual(serviceA.pods.get(identifierB), { session: sdp.Server.UNAVAILABLE_TOKEN, attributes: null, host: null });
			assert.deepStrictEqual(serviceB.pods.get(identifierA), { session: sdp.Server.UNAVAILABLE_TOKEN, attributes: null, host: null });
			assert.deepStrictEqual(serviceA.remoteServices.get(identifierB)!.connected, false);
			assert.deepStrictEqual(serviceB.remoteServices.get(identifierA)!.connected, false);
		});
	});
});
