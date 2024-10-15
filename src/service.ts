//Import Libs.
import { EventEmitter, once } from 'events';
import { AddressInfo } from 'net';

//Import @iprolab Libs.
import { Attrs } from '@iprolab/sdp';
import { Incoming } from '@iprolab/scp';

//Import Local.
import HttpServer, { IServer as IHttpServer, Router, RequestHandler } from './http.server';
import ScpServer, { IServer as IScpServer, Executor, IncomingHandler, Function } from './scp.server';
import SdpServer from './sdp.server';
import HttpProxy, { IProxy as IHttpProxy, ForwardOptions } from './http.proxy';
import ScpClient, { IClient as IScpClient } from './scp.client';

/**
 * Creates a lightweight instance of `Service` for managing HTTP endpoints and facilitating SCP remote function invocation.
 * It ensures smooth communication and coordination by bridging various protocols and managing remote service interactions.
 * 
 * @emits `start` when the service starts.
 * @emits `link` when a link is established.
 * @emits `unlink` when a link is terminated.
 * @emits `stop` when the service stops.
 */
export default class Service extends EventEmitter implements IHttpServer, IScpServer {
    /**
     * The unique identifier of the service.
     */
    public readonly identifier: string;

    /**
     * The HTTP server instance.
     */
    public readonly httpServer: HttpServer;

    /**
     * The SCP server instance.
     */
    public readonly scpServer: ScpServer;

    /**
     * The SDP server instance.
     */
    public readonly sdpServer: SdpServer;

    /**
     * Links to remote services.
     */
    public readonly links: Map<string, Link>;

    /**
     * Creates an instance of service.
     * 
     * @param identifier the unique identifier of the service.
     */
    constructor(identifier: string) {
        super();

        //Initialize Options.
        this.identifier = identifier;

        //Initialize Variables.
        this.httpServer = new HttpServer();
        this.scpServer = new ScpServer(this.identifier);
        this.sdpServer = new SdpServer(this.identifier);
        this.links = new Map();

        //Bind Listeners.
        this.onAvailable = this.onAvailable.bind(this);
        this.onUnavailable = this.onUnavailable.bind(this);

        //Add Listeners.
        this.sdpServer.addListener('available', this.onAvailable);
        this.sdpServer.addListener('unavailable', this.onUnavailable);
    }

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    /**
     * The HTTP routes registered.
     */
    public get routes() {
        return this.httpServer.routes;
    }

    /**
     * The SCP executions registered.
     */
    public get executions() {
        return this.scpServer.executions;
    }

    /**
     * True when the servers are listening for connections, false otherwise.
     */
    public get listening() {
        return {
            http: this.httpServer.listening,
            scp: this.scpServer.listening,
            sdp: this.sdpServer.listening
        }
    }

    /**
     * The bound address, the address family name and port of the servers as reported by the operating system.
     */
    public address() {
        return {
            http: this.httpServer.address() as AddressInfo,
            scp: this.scpServer.address() as AddressInfo,
            sdp: this.sdpServer.address() as AddressInfo
        }
    }

    /**
     * The multicast groups joined.
     */
    public get memberships() {
        return this.sdpServer.memberships;
    }

    /**
     * The local address of the service.
     */
    public get localAddress() {
        return this.sdpServer.localAddress;
    }

    //////////////////////////////
    //////Event Listeners: SDP
    //////////////////////////////
    /**
     * @emits `link` when a link is established.
     */
    private onAvailable(identifier: string, attrs: Attrs, host: string) {
        const link = this.links.get(identifier);
        if (!link) return;

        //Establish connection.
        link.httpProxy.configure(Number(attrs.get('http')), host);
        link.scpClient.connect(Number(attrs.get('scp')), host);
        this.emit('link', link);
    }

    /**
     * @emits `unlink` when a link is terminated.
     */
    private onUnavailable(identifier: string) {
        const link = this.links.get(identifier);
        if (!link) return;

        //Terminate connection.
        link.httpProxy.configured && link.httpProxy.deconfigure();
        link.scpClient.connected && link.scpClient.close();
        this.emit('unlink', link);
    }

    //////////////////////////////
    //////Link
    //////////////////////////////
    /**
     * Returns a `Link` to the remote service.
     * 
     * @param identifier the unique identifier of the remote service.
     */
    public Link(identifier: string) {
        let link = this.links.get(identifier);
        if (link) return link;

        //Forging a new link 🚀🎉.
        link = new Link(identifier, this.identifier);
        this.links.set(identifier, link);
        return link;
    }

    //////////////////////////////
    //////Interface: IHttpServer
    //////////////////////////////
    /**
     * Returns a `Router` to group HTTP routes that share related functionality.
     */
    public Route() {
        return this.httpServer.Route();
    }

    /**
     * Registers a HTTP route for handling GET requests.
     * 
     * @param path the path pattern.
     * @param handlers the request handler functions.
     */
    public get(path: string, ...handlers: Array<RequestHandler>) {
        this.httpServer.get(path, ...handlers);
        return this;
    }

    /**
     * Registers a HTTP route for handling POST requests.
     * 
     * @param path the path pattern.
     * @param handlers the request handler functions.
     */
    public post(path: string, ...handlers: Array<RequestHandler>) {
        this.httpServer.post(path, ...handlers);
        return this;
    }

    /**
     * Registers a HTTP route for handling PUT requests.
     * 
     * @param path the path pattern.
     * @param handlers the request handler functions.
     */
    public put(path: string, ...handlers: Array<RequestHandler>) {
        this.httpServer.put(path, ...handlers);
        return this;
    }

    /**
     * Registers a HTTP route for handling PATCH requests.
     * 
     * @param path the path pattern.
     * @param handlers the request handler functions.
     */
    public patch(path: string, ...handlers: Array<RequestHandler>) {
        this.httpServer.patch(path, ...handlers);
        return this;
    }

    /**
     * Registers a HTTP route for handling DELETE requests.
     * 
     * @param path the path pattern.
     * @param handlers the request handler functions.
     */
    public delete(path: string, ...handlers: Array<RequestHandler>) {
        this.httpServer.delete(path, ...handlers);
        return this;
    }

    /**
     * Registers a HTTP route for handling all requests.
     * 
     * @param path the path pattern.
     * @param handlers the request handler functions.
     */
    public all(path: string, ...handlers: Array<RequestHandler>) {
        this.httpServer.all(path, ...handlers);
        return this;
    }

    /**
     * Mounts multiple HTTP routers.
     * 
     * @param path the path pattern.
     * @param routers the routers to mount.
     */
    public mount(path: string, ...routers: Array<Router>) {
        this.httpServer.mount(path, ...routers);
        return this;
    }

    //////////////////////////////
    //////Interface: IScpServer
    //////////////////////////////
    /**
     * Broadcasts the supplied to all the remote services.
     * 
     * @param operation the operation pattern.
     * @param args the arguments to broadcast.
     */
    public broadcast(operation: string, ...args: Array<any>) {
        return this.scpServer.broadcast(operation, ...args);
    }

    /**
     * Returns a `Executor` to group SCP executions that share related functionality.
     */
    public Execution() {
        return this.scpServer.Execution();
    }

    /**
     * Attaches a SCP executor.
     * 
     * @param operation the operation pattern.
     * @param executor the executor to attach.
     */
    public attach(operation: string, executor: Executor) {
        this.scpServer.attach(operation, executor);
        return this;
    }

    /**
     * Registers a SCP execution for handling OMNI I/O.
     * 
     * @param operation the operation pattern.
     * @param handler the incoming handler function.
     */
    public omni(operation: string, handler: IncomingHandler) {
        this.scpServer.omni(operation, handler);
        return this;
    }

    /**
     * Registers a SCP function for remote execution.
     * 
     * @param operation the operation pattern.
     * @param func the function to be executed remotely.
     */
    public func<Returned>(operation: string, func: Function<Returned>) {
        this.scpServer.func(operation, func);
        return this;
    }

    //////////////////////////////
    //////Start/Stop
    //////////////////////////////
    /**
     * Starts the service by listening on the HTTP, SCP, SDP servers and connecting to the linked remote services.
     * 
     * @param httpPort the HTTP port.
     * @param scpPort the SCP port.
     * @param sdpPort the SDP port.
     * @param sdpAddress the SDP address of the multicast group.
     * @emits `start` when the service starts.
     */
    public async start(httpPort: number, scpPort: number, sdpPort: number, sdpAddress: string) {
        //HTTP
        this.httpServer.listen(httpPort);
        await once(this.httpServer, 'listening');

        //SCP
        this.scpServer.listen(scpPort);
        await once(this.scpServer, 'listening');

        //SDP
        this.sdpServer.attrs.set('http', String(httpPort));
        this.sdpServer.attrs.set('scp', String(scpPort));
        this.sdpServer.listen(sdpPort, sdpAddress);
        await once(this.sdpServer, 'listening');

        //Link
        await Promise.all(Array.from(this.links.values()).map(({ scpClient }) => !scpClient.connected && once(scpClient, 'connect')));

        this.emit('start');
        return this;
    }

    /**
     * Stops the service by closing all the servers and disconnecting from the linked remote services.
     * 
     * @emits `stop` when the service stops.
     */
    public async stop() {
        //HTTP
        this.httpServer.close();
        await once(this.httpServer, 'close');

        //Link
        for (const { httpProxy, scpClient } of this.links.values()) {
            httpProxy.configured && httpProxy.deconfigure();
            scpClient.connected && scpClient.close();
        }
        await Promise.all(Array.from(this.links.values()).map(({ scpClient }) => scpClient.connected && once(scpClient, 'close')));

        //SCP
        this.scpServer.close();
        await once(this.scpServer, 'close');

        //SDP
        this.sdpServer.close();
        await once(this.sdpServer, 'close');

        this.emit('stop');
        return this;
    }
}

//////////////////////////////
//////Link
//////////////////////////////
/**
 * `Link` class manages both HTTP and SCP interactions with a remote service.
 * It handles HTTP proxying and SCP function invocations.
 */
export class Link extends EventEmitter implements IHttpProxy, IScpClient {
    /**
     * The unique identifier of the remote service.
     */
    public readonly identifier: string;

    /**
     * The HTTP `Proxy` instance used to forward requests to the remote service.
     */
    public readonly httpProxy: HttpProxy;

    /**
     * The SCP `Client` instance used to communicate with the remote service.
     */
    public readonly scpClient: ScpClient;

    /**
     * Creates an instance of link.
     * 
     * @param identifier the unique identifier of the remote service.
     * @param serviceIdentifier the unique identifier of the current service.
     */
    constructor(identifier: string, serviceIdentifier: string) {
        super();

        //Initialize Options.
        this.identifier = identifier;

        //Initialize Variables.
        this.httpProxy = new HttpProxy(serviceIdentifier);
        this.scpClient = new ScpClient(serviceIdentifier);
    }

    //////////////////////////////
    //////Interface: IProxy
    //////////////////////////////
    public forward(options?: ForwardOptions) {
        return this.httpProxy.forward(options);
    }

    //////////////////////////////
    //////Interface: IClient
    //////////////////////////////
    public Socket() {
        return this.scpClient.Socket();
    }

    public omni(operation: string, callback: (incoming: Incoming) => void) {
        return this.scpClient.omni(operation, callback);
    }

    public execute<Returned>(operation: string, ...args: Array<any>) {
        return this.scpClient.execute<Returned>(operation, ...args);
    }

    //////////////////////////////
    //////Inherited: Event
    //////////////////////////////
    public once(operation: string | symbol, listener: (...args: Array<any>) => void) {
        this.scpClient.once(operation, listener);
        return this;
    }

    public on(operation: string | symbol, listener: (...args: Array<any>) => void) {
        this.scpClient.on(operation, listener);
        return this;
    }

    public off(operation: string | symbol, listener: (...args: Array<any>) => void) {
        this.scpClient.off(operation, listener);
        return this;
    }
}