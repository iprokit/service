//Import Libs.
import { EventEmitter, once } from 'events';
import { AddressInfo } from 'net';

//Import @iprotechs Libs.
import { Params, Incoming } from '@iprotechs/scp';
import { Attrs } from '@iprotechs/sdp';

//Import Local.
import HttpServer, { IHttpServer, Router, RequestHandler } from './http.server';
import ScpServer, { IScpServer, Receiver, IncomingHandler } from './scp.server';
import ScpClient from './scp.client';
import SdpServer from './sdp.server';
import Utilities, { ProxyOptions } from './utilities';

/**
 * `Service` is as an encapsulation of HTTP, SCP, and SDP servers, along with their corresponding clients.
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
     * The SCP remotes registered.
     */
    public get remotes() {
        return this.scpServer.remotes;
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
        link.proxyOptions.port = Number(attrs.get('http')), link.proxyOptions.host = host;
        link.scpClient.connect(Number(attrs.get('scp')), host);
        this.emit('link', link);
    }

    /**
     * @emits `unlink` when a link is terminated.
     */
    private onUnavailable(identifier: string, attrs: Attrs, host: string) {
        const link = this.links.get(identifier);
        if (!link) return;

        //Terminate connection.
        link.proxyOptions.port = undefined, link.proxyOptions.host = undefined;
        link.scpClient.connected && link.scpClient.close();
        this.emit('unlink', link);
    }

    //////////////////////////////
    //////Link
    //////////////////////////////
    /**
     * Links the service to the remote services.
     * 
     * @param identifiers the unique identifiers of the remote services.
     */
    public link(...identifiers: Array<string>) {
        //Forging new links 🚀🎉.
        for (const identifier of identifiers) {
            this.links.set(identifier, { proxyOptions: { host: undefined, port: undefined }, scpClient: new ScpClient(identifier) });
        }
        return this;
    }

    //////////////////////////////
    //////Interface: HttpServer
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
    //////HTTP: Proxy
    //////////////////////////////
    /**
     * Proxies HTTP requests to the linked remote service.
     * 
     * @param path the path to match for the requests to be proxied.
     * @param identifier the unique identifier of the linked remote service.
     */
    public proxy(path: string, identifier: string) {
        const link = this.links.get(identifier);
        if (!link) throw new Error('SERVICE_LINK_INVALID_IDENTIFIER');

        //Proxy(📬)
        this.httpServer.all(path, Utilities.proxy(link.proxyOptions));
        return this;
    }

    //////////////////////////////
    //////Interface: ScpServer
    //////////////////////////////
    /**
     * Broadcasts the supplied to all remote services.
     * 
     * @param operation the operation pattern.
     * @param data the data to broadcast.
     * @param params the optional input/output parameters of the broadcast.
     */
    public broadcast(operation: string, data: string, params?: Iterable<readonly [string, string]>) {
        this.scpServer.broadcast(operation, data, params);
        return this;
    }

    /**
     * Returns a `Receiver` to group remote functions that share related functionality.
     */
    public Remote() {
        return this.scpServer.Remote();
    }

    /**
     * Attaches a receiver.
     * 
     * @param operation the operation pattern.
     * @param receiver the receiver to attach.
     */
    public attach(name: string, receiver: Receiver) {
        this.scpServer.attach(name, receiver);
        return this;
    }

    /**
     * Registers a remote function for handling REPLY I/O.
     * 
     * @param operation the operation pattern.
     * @param handler the incoming handler function.
     */
    public reply(operation: string, handler: IncomingHandler) {
        this.scpServer.reply(operation, handler);
        return this;
    }

    //////////////////////////////
    //////SCP: Client
    //////////////////////////////
    /**
     * Registers a listener for broadcast events from the linked remote service.
     * 
     * @param identifier the unique identifier of the linked remote service.
     * @param operation the operation pattern.
     * @param listener the listener called when a broadcast is received.
     */
    public onBroadcast(identifier: string, operation: string, listener: (data: string, params: Params) => void) {
        const link = this.links.get(identifier);
        if (!link) throw new Error('SERVICE_LINK_INVALID_IDENTIFIER');

        //Broadcast(📢)
        link.scpClient.onBroadcast(operation, listener);
        return this;
    }

    /**
     * Creates an `Outgoing` stream to send a message and an `Incoming` stream to receive a reply from the linked remote service.
     * 
     * @param identifier the unique identifier of the linked remote service.
     * @param operation the operation pattern.
     * @param callback called when the reply is available on the `Incoming` stream.
     */
    public message(identifier: string, operation: string, callback?: (incoming: Incoming) => void) {
        const link = this.links.get(identifier);
        if (!link) throw new Error('SERVICE_LINK_INVALID_IDENTIFIER');

        //Message(📩)
        return link.scpClient.message(operation, callback);
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
        for (const { proxyOptions, scpClient } of this.links.values()) {
            proxyOptions.port = undefined, proxyOptions.host = undefined;
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
 * Represents a link to a remote service.
 */
export interface Link {
    /**
     * Configuration options for establishing a HTTP proxy connection to the remote service.
     */
    proxyOptions: ProxyOptions;

    /**
     * The ScpClient instance used to communicate with the remote service.
     */
    scpClient: ScpClient;
}