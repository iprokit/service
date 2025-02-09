// Import Libs.
import { EventEmitter, once } from 'events';
import { AddressInfo } from 'net';

// Import Local.
import { Server as HttpServer, IServer as IHttpServer, IRouter, RequestHandler } from './http';
import { Server as ScpServer, IServer as IScpServer, IExecutor, IncomingHandler, ReplyFunction, ConductorFunction, Client as RemoteService, ClientOptions as RemoteServiceOptions } from './scp';
import { Server as SdpServer, Attributes as SdpAttributes } from './sdp';

/**
 * A lightweight `Service` for managing HTTP routes and SCP executions.
 * Ensures smooth communication and coordination by bridging protocols and managing remote service interactions.
 *
 * @emits `start` when the service starts.
 * @emits `stop` when the service stops.
 */
export default class Service extends EventEmitter implements IHttpServer, IScpServer {
	/**
	 * Unique identifier of the service.
	 */
	public readonly identifier: string;

	/**
	 * HTTP server instance.
	 */
	public readonly httpServer: HttpServer;

	/**
	 * SCP server instance.
	 */
	public readonly scpServer: ScpServer;

	/**
	 * SDP server instance.
	 */
	public readonly sdpServer: SdpServer;

	/**
	 * Remote service instances.
	 */
	public readonly remoteServices: Map<string, RemoteService>;

	/**
	 * Creates an instance of `Service`.
	 *
	 * @param identifier unique identifier of the service.
	 */
	constructor(identifier: string) {
		super();

		// Initialize options.
		this.identifier = identifier;

		// Initialize variables.
		this.httpServer = new HttpServer(this.identifier);
		this.scpServer = new ScpServer(this.identifier);
		this.sdpServer = new SdpServer(this.identifier);
		this.remoteServices = new Map();

		// Bind listeners.
		this.onAvailable = this.onAvailable.bind(this);
		this.onUnavailable = this.onUnavailable.bind(this);

		// Add listeners.
		this.sdpServer.addListener('available', this.onAvailable);
		this.sdpServer.addListener('unavailable', this.onUnavailable);
	}

	//////////////////////////////
	//////// Gets/Sets
	//////////////////////////////
	/**
	 * HTTP routes registered.
	 */
	public get routes() {
		return this.httpServer.routes;
	}

	/**
	 * SCP executions registered.
	 */
	public get executions() {
		return this.scpServer.executions;
	}

	/**
	 * SDP pods discovered.
	 */
	public get pods() {
		return this.sdpServer.pods;
	}

	/**
	 * `true` if the servers are listening for connections, `false` otherwise.
	 */
	public get listening() {
		return {
			http: this.httpServer.listening,
			scp: this.scpServer.listening,
			sdp: this.sdpServer.listening
		};
	}

	/**
	 * Retrieves the bound address, family, and port of the servers as reported by the operating system.
	 */
	public address() {
		return {
			http: this.httpServer.address() as AddressInfo | null,
			scp: this.scpServer.address() as AddressInfo | null,
			sdp: this.sdpServer.address() as AddressInfo | null
		};
	}

	/**
	 * Multicast group that have been joined.
	 */
	public get membership() {
		return this.sdpServer.membership;
	}

	/**
	 * Local address of the service.
	 */
	public get localAddress() {
		return this.sdpServer.localAddress;
	}

	//////////////////////////////
	//////// Event Listeners
	//////////////////////////////
	/**
	 * Establishes the connection to a remote service.
	 */
	private onAvailable(identifier: string, attributes: Attributes, host: string) {
		const remoteService = this.remoteServices.get(identifier);
		if (remoteService && !remoteService.connected) {
			remoteService.connect(Number(attributes['scp']), host);
		}
	}

	/**
	 * Terminates the connection to a remote service.
	 */
	private onUnavailable(identifier: string) {
		const remoteService = this.remoteServices.get(identifier);
		if (remoteService && remoteService.connected) {
			remoteService.close();
		}
	}

	//////////////////////////////
	//////// Link
	//////////////////////////////
	/**
	 * Links this service to a remote service.
	 *
	 * No-op if the remote service is already linked.
	 *
	 * @param identifier unique identifier of the remote service.
	 * @param remoteService remote service instance.
	 */
	public link(identifier: string, remoteService: RemoteService) {
		if (!this.remoteServices.has(identifier)) {
			this.remoteServices.set(identifier, remoteService);
		}
		return this;
	}

	//////////////////////////////
	//////// IHttpServer
	//////////////////////////////
	/**
	 * Registers a HTTP route for handling GET requests.
	 *
	 * @param path path pattern.
	 * @param handlers request handler functions.
	 */
	public get(path: string, ...handlers: Array<RequestHandler>) {
		this.httpServer.get(path, ...handlers);
		return this;
	}

	/**
	 * Registers a HTTP route for handling POST requests.
	 *
	 * @param path path pattern.
	 * @param handlers request handler functions.
	 */
	public post(path: string, ...handlers: Array<RequestHandler>) {
		this.httpServer.post(path, ...handlers);
		return this;
	}

	/**
	 * Registers a HTTP route for handling PUT requests.
	 *
	 * @param path path pattern.
	 * @param handlers request handler functions.
	 */
	public put(path: string, ...handlers: Array<RequestHandler>) {
		this.httpServer.put(path, ...handlers);
		return this;
	}

	/**
	 * Registers a HTTP route for handling PATCH requests.
	 *
	 * @param path path pattern.
	 * @param handlers request handler functions.
	 */
	public patch(path: string, ...handlers: Array<RequestHandler>) {
		this.httpServer.patch(path, ...handlers);
		return this;
	}

	/**
	 * Registers a HTTP route for handling DELETE requests.
	 *
	 * @param path path pattern.
	 * @param handlers request handler functions.
	 */
	public delete(path: string, ...handlers: Array<RequestHandler>) {
		this.httpServer.delete(path, ...handlers);
		return this;
	}

	/**
	 * Registers a HTTP route for handling ALL requests.
	 *
	 * @param path path pattern.
	 * @param handlers request handler functions.
	 */
	public all(path: string, ...handlers: Array<RequestHandler>) {
		this.httpServer.all(path, ...handlers);
		return this;
	}

	/**
	 * Mounts multiple HTTP routers.
	 *
	 * @param path path pattern.
	 * @param routers routers to mount.
	 */
	public mount(path: string, ...routers: Array<IRouter>) {
		this.httpServer.mount(path, ...routers);
		return this;
	}

	//////////////////////////////
	//////// IScpServer
	//////////////////////////////
	/**
	 * Broadcasts the supplied to all remote services.
	 * Returns identifiers of remote services that successfully received broadcast.
	 *
	 * @param operation operation pattern.
	 * @param args arguments to broadcast.
	 */
	public broadcast(operation: string, ...args: Array<any>) {
		return this.scpServer.broadcast(operation, ...args);
	}

	/**
	 * Registers a SCP execution for handling REPLY I/O.
	 *
	 * Remote handler function receives a message from a remote service and returns a reply.
	 *
	 * @param operation operation pattern.
	 * @param func function to be executed.
	 */
	public reply<Returned>(operation: string, func: ReplyFunction<Returned>) {
		this.scpServer.reply(operation, func);
		return this;
	}

	/**
	 * Registers a SCP execution for handling CONDUCTOR I/O.
	 *
	 * Remote handler function receives a message from a remote service and coordinates signals.
	 *
	 * @param operation operation pattern.
	 * @param func function to be executed.
	 */
	public conductor(operation: string, func: ConductorFunction) {
		this.scpServer.conductor(operation, func);
		return this;
	}

	/**
	 * Registers a SCP execution for handling OMNI I/O.
	 *
	 * @param operation operation pattern.
	 * @param handler incoming handler function.
	 */
	public omni(operation: string, handler: IncomingHandler) {
		this.scpServer.omni(operation, handler);
		return this;
	}

	/**
	 * Attaches a SCP executor.
	 *
	 * @param operation operation pattern.
	 * @param executor executor to attach.
	 */
	public attach(operation: string, executor: IExecutor) {
		this.scpServer.attach(operation, executor);
		return this;
	}

	//////////////////////////////
	//////// Start/Stop
	//////////////////////////////
	/**
	 * Starts the service by listening on HTTP, SCP, and SDP servers, connecting to remote services registered.
	 *
	 * @param httpPort local HTTP port.
	 * @param scpPort local SCP port.
	 * @param sdpPort local SDP port.
	 * @param sdpAddress address of the SDP multicast group.
	 * @emits `start` when the service starts.
	 */
	public async start(httpPort: number, scpPort: number, sdpPort: number, sdpAddress: string) {
		// HTTP
		this.httpServer.listen(httpPort);
		await once(this.httpServer, 'listening');

		// SCP
		this.scpServer.listen(scpPort);
		await once(this.scpServer, 'listening');

		// SDP
		(this.sdpServer.attributes as Attributes)['http'] = String(httpPort);
		(this.sdpServer.attributes as Attributes)['scp'] = String(scpPort);
		this.sdpServer.listen(sdpPort, sdpAddress);
		await once(this.sdpServer, 'listening');

		// Remote Services
		const connections = new Array<Promise<Array<void>>>();
		for (const remoteService of this.remoteServices.values()) {
			if (!remoteService.connected) {
				connections.push(once(remoteService, 'connect'));
			}
		}
		await Promise.all(connections);

		this.emit('start');
		return this;
	}

	/**
	 * Stops the service by closing all servers and disconnecting from remote services registered.
	 *
	 * @emits `stop` when the service stops.
	 */
	public async stop() {
		// HTTP
		this.httpServer.close();
		await once(this.httpServer, 'close');

		// Remote Services
		const connections = new Array<Promise<Array<void>>>();
		for (const remoteService of this.remoteServices.values()) {
			if (remoteService.connected) {
				remoteService.close();
				connections.push(once(remoteService, 'close'));
			}
		}
		await Promise.all(connections);

		// SCP
		this.scpServer.close();
		await once(this.scpServer, 'close');

		// SDP
		this.sdpServer.close();
		await once(this.sdpServer, 'close');

		this.emit('stop');
		return this;
	}
}

//////////////////////////////
//////// Remote Service
//////////////////////////////
export { RemoteService, RemoteServiceOptions };

//////////////////////////////
//////// Attributes
//////////////////////////////
export interface Attributes extends SdpAttributes {
	http: string;
	scp: string;
}
