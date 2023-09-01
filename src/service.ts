//Import Libs.
import { EventEmitter } from 'events';
import { AddressInfo } from 'net';
import { promisify } from 'util';

//Import @iprotechs Libs.
import { Params } from '@iprotechs/scp';
import { Pod, Args, Discovery } from '@iprotechs/discovery';

//Import Local.
import HttpServer, { RequestHandler } from './http.server';
import ScpServer from './scp.server';
import ScpClient from './scp.client';
import Utilities, { HttpRelay, ReplyFunction } from './utilities';

export default class Service extends EventEmitter {
    public readonly identifier: string;

    public readonly httpServer: HttpServer;
    public readonly scpServer: ScpServer;
    public readonly discovery: Discovery;

    public readonly links: Array<Link>;

    constructor(identifier: string) {
        super();

        //Initialize Options.
        this.identifier = identifier;

        //Initialize Variables.
        this.httpServer = new HttpServer();
        this.scpServer = new ScpServer(this.identifier);
        this.discovery = new Discovery();
        this.links = new Array();

        //Bind Listeners.
        this.onDiscover = this.onDiscover.bind(this);
        this.onUpdate = this.onUpdate.bind(this);

        //Add Listeners.
        this.discovery.addListener('discover', this.onDiscover);
        this.discovery.addListener('update', this.onUpdate);
    }

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    public get routes() {
        return this.httpServer.routes;
    }

    public get remoteFunctions() {
        return this.scpServer.remoteFunctions;
    }

    public get listening() {
        return {
            http: this.httpServer.listening,
            scp: this.scpServer.listening,
            discovery: this.discovery.listening
        }
    }

    public address() {
        return {
            http: this.httpServer.address() as AddressInfo,
            scp: this.scpServer.address() as AddressInfo,
            discovery: this.discovery.address() as AddressInfo
        }
    }

    public get multicastAddress() {
        return this.discovery.multicastAddress;
    }

    public localAddress() {
        return Utilities.localAddress();
    }

    //////////////////////////////
    //////Event Listeners: Discovery
    //////////////////////////////
    private onDiscover(pod: Pod) {
        const { identifier, args: { http, scp, host } } = pod;

        //Create/Get link.
        const link = this.link(identifier);
        const { httpRelay, scpClient } = link;

        //Establish connection.
        httpRelay.configure(Number(http), host);
        scpClient.connect(Number(scp), host, () => this.emit('connect', link));
    }

    private onUpdate(pod: Pod) {
        const { identifier, args: { http, scp, host } } = pod;

        //Get link.
        const link = this.getLink(identifier);
        const { httpRelay, scpClient } = link;

        //Be ready to be confused 😈.
        if (!pod.available && !scpClient.connected) { /* Closed. */
            this.emit('close', link);
        }
        if (pod.available && !scpClient.connected) { /* Reconnected. */
            httpRelay.configure(Number(http), host);
            scpClient.connect(Number(scp), host, () => this.emit('connect', link));
        }
        if (!pod.available && scpClient.connected) { /* Closing. */ }
        if (pod.available && scpClient.connected) { /* Wont happen. */ }
    }

    //////////////////////////////
    //////Link
    //////////////////////////////
    public link(identifier: string) {
        let link = this.getLink(identifier);
        if (link) return link;

        //Forging a new link 🚀🎉.
        link = { identifier, httpRelay: new HttpRelay(), scpClient: new ScpClient(identifier) }
        this.links.push(link);
        return link;
    }

    public getLink(identifier: string) {
        return this.links.find((link) => link.identifier === identifier);
    }

    //////////////////////////////
    //////HTTP
    //////////////////////////////
    public get(path: string, handler: RequestHandler) {
        this.httpServer.get(path, handler);
        return this;
    }

    public post(path: string, handler: RequestHandler) {
        this.httpServer.post(path, handler);
        return this;
    }

    public put(path: string, handler: RequestHandler) {
        this.httpServer.put(path, handler);
        return this;
    }

    public patch(path: string, handler: RequestHandler) {
        this.httpServer.patch(path, handler);
        return this;
    }

    public delete(path: string, handler: RequestHandler) {
        this.httpServer.delete(path, handler);
        return this;
    }

    public all(path: string, handler: RequestHandler) {
        this.httpServer.all(path, handler);
        return this;
    }

    //////////////////////////////
    //////HTTP: Proxy
    //////////////////////////////
    public proxy(path: string, identifier: string) {
        const { httpRelay } = this.getLink(identifier);
        this.all(path, Utilities.proxy(httpRelay));
        return this;
    }

    //////////////////////////////
    //////SCP
    //////////////////////////////
    public reply<Reply>(map: string, replyFunction: ReplyFunction<Reply>) {
        this.scpServer.reply(map, Utilities.reply(replyFunction));
        return this;
    }

    public broadcast(map: string, ...payload: Array<any>) {
        this.scpServer.broadcast(map, JSON.stringify(payload), { FORMAT: 'OBJECT' });
        return this;
    }

    //////////////////////////////
    //////SCP: Client
    //////////////////////////////
    public async message<Reply>(identifier: string, map: string, ...message: Array<any>) {
        const { scpClient } = this.getLink(identifier);
        return await Utilities.message<Reply>(scpClient, map, ...message);
    }

    public onBroadcast(identifier: string, map: string, listener: (...payload: Array<any>) => void) {
        const { scpClient } = this.getLink(identifier);
        scpClient.on(map, (payload: string, params: Params) => {
            if (params.FORMAT === 'OBJECT') return listener(...JSON.parse(payload));
            listener(payload, params);
        });
        return this;
    }

    //////////////////////////////
    //////Start/Stop
    //////////////////////////////
    public async start(http: number, scp: number, discovery: number, multicast: string) {
        const discoveryArgs: Args = { http: String(http), scp: String(scp), host: this.localAddress() }
        await promisify(this.httpServer.listen).bind(this.httpServer)(http);
        await promisify(this.scpServer.listen).bind(this.scpServer)(scp);
        await promisify(this.discovery.bind).bind(this.discovery)(discovery, multicast, this.identifier, discoveryArgs);
        this.emit('start');
        return this;
    }

    public async stop() {
        await promisify(this.httpServer.close).bind(this.httpServer)();
        await Promise.all(this.links.map(async ({ scpClient }) => scpClient.connected && await promisify(scpClient.close).bind(scpClient)()));
        await promisify(this.scpServer.close).bind(this.scpServer)();
        await promisify(this.discovery.close).bind(this.discovery)();
        this.emit('stop');
        return this;
    }
}
//////////////////////////////
//////Link
//////////////////////////////
export interface Link {
    identifier: string;
    httpRelay: HttpRelay;
    scpClient: ScpClient;
}