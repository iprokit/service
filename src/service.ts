//Import Libs.
import { EventEmitter, once } from 'events';
import { AddressInfo } from 'net';

//Import @iprotechs Libs.
import { Params } from '@iprotechs/scp';
import { Attrs } from '@iprotechs/sdp';

//Import Local.
import HttpServer, { RequestHandler } from './http.server';
import ScpServer from './scp.server';
import ScpClient from './scp.client';
import SdpServer from './sdp.server';
import Utilities, { ProxyOptions, ReplyFunction } from './utilities';

//////////////////////////////
//////Singleton
//////////////////////////////
/**
 * The singleton instance of `Service`.
 */
export let service: Service;

/**
 * Creates a lightweight, singleton instance of `Service` for managing HTTP endpoints and facilitating SCP remote function invocation.
 * It ensures smooth communication and coordination by bridging various protocols and managing remote service interactions.
 * 
 * @param identifier the unique identifier of the service.
 */
export default function (identifier: string) {
    return service ?? (service = new Service(identifier));
}

/**
 * `Service` is as an encapsulation of HTTP, SCP, and SDP servers, along with their corresponding clients.
 * 
 * @emits `start` when the service starts.
 * @emits `link` when a link is established.
 * @emits `unlink` when a link is terminated.
 * @emits `stop` when the service stops.
 */
export class Service extends EventEmitter {
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
     * The HTTP server routes.
     */
    public get routes() {
        return this.httpServer.routes;
    }

    /**
     * The SCP remote functions.
     */
    public get remoteFunctions() {
        return this.scpServer.remoteFunctions;
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
    //////HTTP
    //////////////////////////////
    /**
     * Registers a HTTP route for handling GET requests.
     * 
     * @param path the route path.
     * @param handler the request handler function.
     */
    public get(path: string, handler: RequestHandler) {
        this.httpServer.get(path, handler);
        return this;
    }

    /**
     * Registers a HTTP route for handling POST requests.
     * 
     * @param path the route path.
     * @param handler the request handler function.
     */
    public post(path: string, handler: RequestHandler) {
        this.httpServer.post(path, handler);
        return this;
    }

    /**
     * Registers a HTTP route for handling PUT requests.
     * 
     * @param path the route path.
     * @param handler the request handler function.
     */
    public put(path: string, handler: RequestHandler) {
        this.httpServer.put(path, handler);
        return this;
    }

    /**
     * Registers a HTTP route for handling PATCH requests.
     * 
     * @param path the route path.
     * @param handler the request handler function.
     */
    public patch(path: string, handler: RequestHandler) {
        this.httpServer.patch(path, handler);
        return this;
    }

    /**
     * Registers a HTTP route for handling DELETE requests.
     * 
     * @param path the route path.
     * @param handler the request handler function.
     */
    public delete(path: string, handler: RequestHandler) {
        this.httpServer.delete(path, handler);
        return this;
    }

    /**
     * Registers a HTTP route for handling all requests.
     * 
     * @param path the route path.
     * @param handler the request handler function.
     */
    public all(path: string, handler: RequestHandler) {
        this.httpServer.all(path, handler);
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
    //////SCP
    //////////////////////////////
    /**
     * Registers a SCP remote function for handling REPLY.
     * 
     * @param operation the operation of the remote function.
     * @param replyFunction the reply function.
     */
    public reply<Reply>(operation: string, replyFunction: ReplyFunction<Reply>) {
        this.scpServer.reply(operation, Utilities.reply(replyFunction));
        return this;
    }

    /**
     * Broadcasts the supplied to all remote services.
     * 
     * @param operation the operation of the broadcast.
     * @param broadcast the data to broadcast.
     */
    public broadcast(operation: string, ...broadcast: Array<any>) {
        this.scpServer.broadcast(operation, JSON.stringify(broadcast), [['FORMAT', 'OBJECT']]);
        return this;
    }

    //////////////////////////////
    //////SCP: Client
    //////////////////////////////
    /**
     * Sends a message to the remote function of the linked remote service and returns a promise that resolves to the received reply.
     * 
     * @param identifier the unique identifier of the linked remote service.
     * @param operation the operation of the remote function.
     * @param message the message to send.
     */
    public async message<Reply>(identifier: string, operation: string, ...message: Array<any>) {
        const link = this.links.get(identifier);
        if (!link) throw new Error('SERVICE_LINK_INVALID_IDENTIFIER');

        //Message(📩)
        return await Utilities.message<Reply>(link.scpClient, operation, ...message);
    }

    /**
     * Registers a listener for broadcast events for the linked remote service.
     * 
     * @param identifier the unique identifier of the linked remote service.
     * @param operation the operation of the broadcast.
     * @param listener the listener called when a broadcast is received.
     */
    public onBroadcast(identifier: string, operation: string, listener: (...broadcast: Array<any>) => void) {
        const link = this.links.get(identifier);
        if (!link) throw new Error('SERVICE_LINK_INVALID_IDENTIFIER');

        //Broadcast(📢)
        link.scpClient.on(operation, (data: string, params: Params) => {
            if (params.get('FORMAT') === 'OBJECT') return listener(...JSON.parse(data));
            listener(data, params);
        });
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

//////////////////////////////
//////Decorators: HTTP
//////////////////////////////
/**
 * Decorators for registering HTTP routes.
 */
export namespace HTTP {
    /**
     * Decorator for registering an HTTP route for handling GET requests.
     * 
     * @param path the route path.
     */
    export function Get(path: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            service.get(path, descriptor.value);
            return descriptor;
        }
    }

    /**
     * Decorator for registering an HTTP route for handling POST requests.
     * 
     * @param path the route path.
     */
    export function Post(path: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            service.post(path, descriptor.value);
            return descriptor;
        }
    }

    /**
     * Decorator for registering an HTTP route for handling PUT requests.
     * 
     * @param path the route path.
     */
    export function Put(path: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            service.put(path, descriptor.value);
            return descriptor;
        }
    }

    /**
     * Decorator for registering an HTTP route for handling PATCH requests.
     * 
     * @param path the route path.
     */
    export function Patch(path: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            service.patch(path, descriptor.value);
            return descriptor;
        }
    }

    /**
     * Decorator for registering an HTTP route for handling DELETE requests.
     * 
     * @param path the route path.
     */
    export function Delete(path: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            service.delete(path, descriptor.value);
            return descriptor;
        }
    }

    /**
     * Decorator for registering an HTTP route for handling all requests.
     * 
     * @param path the route path.
     */
    export function All(path: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            service.all(path, descriptor.value);
            return descriptor;
        }
    }
}

//////////////////////////////
//////Decorators: SCP
//////////////////////////////
/**
 * Decorators for registering SCP remote functions.
 */
export namespace SCP {
    /**
     * Decorator for registering an SCP remote function for handling REPLY.
     * 
     * @param operation the operation of the remote function.
     */
    export function Reply(operation: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            service.reply(operation, descriptor.value);
            return descriptor;
        }
    }

    /**
     * Decorator for registering a listener for broadcast events for the linked remote service.
     * 
     * @param identifier the unique identifier of the linked remote service.
     * @param operation the operation of the broadcast.
     */
    export function OnBroadcast(identifier: string, operation: string) {
        return (target: any, key: string, descriptor: PropertyDescriptor) => {
            service.onBroadcast(identifier, operation, descriptor.value);
            return descriptor;
        }
    }
}