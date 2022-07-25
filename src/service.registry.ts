//Import @iprotechs Libs.
import { Node } from '@iprotechs/scp';

//Import Local.
import { ProxyHandler } from './proxy';

/**
 * `ServiceRegistry` is a registry of `RemoteService`'s.
 */
export default class ServiceRegistry {
    /**
     * The `RemoteService`'s registered.
     */
    public readonly remoteServices: Array<RemoteService>;

    /**
     * Creates an instance of `ServiceRegistry`.
     */
    constructor() {
        this.remoteServices = new Array();
    }

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    /**
     * True if the all the `RemoteService`'s are connected, false otherwise.
     * `undefined` if no connections.
     */
    public get connected() {
        //Try getting all the remoteService that is defined by the consumer.
        const remoteServices = this.remoteServices.filter(remoteService => remoteService.defined);

        if (remoteServices.length === 0) {
            return undefined;
        }

        //Try getting remoteService that disconnected.
        const remoteService = remoteServices.find(remoteService => !remoteService.node.connected && !remoteService.proxyHandler.linked);

        return (remoteService === undefined) ? true : false;
    }

    //////////////////////////////
    //////Register/Deregister
    //////////////////////////////
    /**
     * Registeres the `RemoteService`.
     * 
     * @param remoteService the remote service.
     */
    public register(remoteService: RemoteService) {
        this.remoteServices.push(remoteService);
    }

    /**
     * Deregisters the `RemoteService`.
     * 
     * @param remoteService the remote service.
     */
    public deregister(remoteService: RemoteService) {
        const index = this.remoteServices.findIndex(_remoteService => _remoteService === remoteService);
        this.remoteServices.splice(index, 1);
    }

    //////////////////////////////
    //////Get
    //////////////////////////////
    /**
     * Returns the `RemoteService` found.
     * 
     * @param name the name of the remote service.
     */
    public getByName(name: string) {
        return name ? this.remoteServices.find(remoteService => remoteService.name === name) : undefined;
    }

    /**
     * Returns the `RemoteService` found.
     * 
     * @param alias the alias of the remote service.
     */
    public getByAlias(alias: string) {
        return alias ? this.remoteServices.find(remoteService => remoteService.alias === alias) : undefined;
    }
}

//////////////////////////////
//////RemoteService
//////////////////////////////
/**
 * `RemoteService` is a representation of a service that is remote; in the form of an object.
 */
export class RemoteService {
    /**
     * The name of the service.
     */
    public readonly name: string;

    /**
     * The alias name of the service.
     */
    public readonly alias: string;

    /**
     * True if the service is defined by the consumer, false if auto discovered.
     */
    public readonly defined: boolean;

    /**
     * The instance of `Node`.
     */
    public readonly node: Node;

    /**
     * The instance of `ProxyHandler`.
     */
    public readonly proxyHandler: ProxyHandler;

    /**
     * Creates an instance of `RemoteService`.
     * 
     * @param name the name of the service.
     * @param alias the optional, alias name of the service.
     * @param defined set to true if the service is defined by the consumer, false if auto discovered.
     * @param node the instance of `Node`.
     * @param proxyHandler the instance of `ProxyHandler`.
     */
    constructor(name: string, alias: string, defined: boolean, node: Node, proxyHandler: ProxyHandler) {
        this.name = name;
        this.alias = alias;
        this.defined = defined;
        this.node = node;
        this.proxyHandler = proxyHandler;
    }

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    /**
     * The remote HTTP address.
     */
    public get httpAddress() {
        return this.proxyHandler.host;
    }

    /**
     * The remote HTTP port.
     */
    public get httpPort() {
        return this.proxyHandler.port;
    }

    /**
     * The remote SCP address.
     */
    public get scpAddress() {
        return this.node.remoteAddress;
    }

    /**
     * The remote SCP port.
     */
    public get scpPort() {
        return this.node.remotePort;
    }

    /**
     * True if the remote service is connected, false if disconnected.
     */
    public get connected() {
        return this.proxyHandler.linked && this.node.connected;
    }

    //////////////////////////////
    //////Connection Management
    //////////////////////////////
    /**
     * Connect to the remote service.
     * 
     * @param address the remote address.
     * @param httpPort the remote HTTP port.
     * @param scpPort the remote SCP port.
     * @param callback optional callback. Will be called once connected.
     */
    public connect(address: string, httpPort: number, scpPort: number, callback?: () => void) {
        this.proxyHandler.link(httpPort, address);
        this.node.connect(scpPort, address, callback);
    }

    /**
     * Disconnect from the remote service.
     * 
     * @param callback optional callback. Will be called once disconnected.
     */
    public disconnect(callback?: () => void) {
        this.proxyHandler.unlink();
        this.node.disconnect(callback);
    }
}