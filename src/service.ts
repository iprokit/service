//Import Libs.
import { EventEmitter } from 'events';
import { AddressInfo } from 'net';
import { promisify } from 'util';

//Import @iprotechs Libs.
import { Params } from '@iprotechs/scp';
import { Pod } from '@iprotechs/sdp';

//Import Local.
import HttpServer, { RequestHandler } from './http.server';
import ScpServer from './scp.server';
import ScpClient from './scp.client';
import SdpServer from './sdp.server';
import Utilities, { HttpRelay, ReplyFunction } from './utilities';

export default class Service extends EventEmitter {
    public readonly identifier: string;

    public readonly httpServer: HttpServer;
    public readonly scpServer: ScpServer;
    public readonly sdpServer: SdpServer;

    public readonly links: Array<Link>;

    constructor(identifier: string) {
        super();

        //Initialize Options.
        this.identifier = identifier;

        //Initialize Variables.
        this.httpServer = new HttpServer();
        this.scpServer = new ScpServer(this.identifier);
        this.sdpServer = new SdpServer(this.identifier);
        this.links = new Array();

        //Bind Listeners.
        this.onDiscover = this.onDiscover.bind(this);
        this.onUpdate = this.onUpdate.bind(this);

        //Add Listeners.
        this.sdpServer.addListener('discover', this.onDiscover);
        this.sdpServer.addListener('update', this.onUpdate);
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
            sdp: this.sdpServer.listening
        }
    }

    public address() {
        return {
            http: this.httpServer.address() as AddressInfo,
            scp: this.scpServer.address() as AddressInfo,
            sdp: this.sdpServer.address() as AddressInfo
        }
    }

    public get memberships() {
        return this.sdpServer.memberships;
    }

    public get localAddress() {
        return this.sdpServer.localAddress;
    }

    //////////////////////////////
    //////Event Listeners: SDP
    //////////////////////////////
    private onDiscover(pod: Pod) {
        const http = pod.get('http');
        const scp = pod.get('scp');
        const host = pod.get('host');

        //Create/Get link.
        const link = this.link(pod.identifier);
        const { httpRelay, scpClient } = link;

        //Establish connection.
        httpRelay.configure(Number(http), host);
        scpClient.connect(Number(scp), host, () => this.emit('connect', link));
    }

    private onUpdate(pod: Pod) {
        const http = pod.get('http');
        const scp = pod.get('scp');
        const host = pod.get('host');

        //Get link.
        const link = this.getLink(pod.identifier);
        const { httpRelay, scpClient } = link;

        //Be ready to be confused 😈.
        if (!pod.available && !scpClient.connected) { /* Closed. */
            this.emit('close', link);
            return;
        }
        if (pod.available && !scpClient.connected) { /* Reconnected. */
            httpRelay.configure(Number(http), host);
            scpClient.connect(Number(scp), host, () => this.emit('connect', link));
            return;
        }
        if (!pod.available && scpClient.connected) return; /* Closing. */
        if (pod.available && scpClient.connected) return; /* Wont happen. */
    }

    //////////////////////////////
    //////Link
    //////////////////////////////
    public link(identifier: string) {
        let link = this.getLink(identifier);
        if (link) return link;

        //Forging a new link 🚀🎉.
        link = { identifier, httpRelay: new HttpRelay(identifier), scpClient: new ScpClient(identifier) }
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
    public reply<Reply>(operation: string, replyFunction: ReplyFunction<Reply>) {
        this.scpServer.reply(operation, Utilities.reply(replyFunction));
        return this;
    }

    public broadcast(operation: string, ...broadcast: Array<any>) {
        this.scpServer.broadcast(operation, JSON.stringify(broadcast), [['FORMAT', 'OBJECT']]);
        return this;
    }

    //////////////////////////////
    //////SCP: Client
    //////////////////////////////
    public async message<Reply>(identifier: string, operation: string, ...message: Array<any>) {
        const { scpClient } = this.getLink(identifier);
        return await Utilities.message<Reply>(scpClient, operation, ...message);
    }

    public onBroadcast(identifier: string, operation: string, listener: (...broadcast: Array<any>) => void) {
        const { scpClient } = this.getLink(identifier);
        scpClient.on(operation, (data: string, params: Params) => {
            if (params.get('FORMAT') === 'OBJECT') return listener(...JSON.parse(data));
            listener(data, params);
        });
        return this;
    }

    //////////////////////////////
    //////Start/Stop
    //////////////////////////////
    public async start(http: number, scp: number, sdp: number, address: string) {
        this.sdpServer.attrs.set('http', String(http));
        this.sdpServer.attrs.set('scp', String(scp));

        await promisify(this.httpServer.listen).bind(this.httpServer)(http);
        await promisify(this.scpServer.listen).bind(this.scpServer)(scp);
        await promisify(this.sdpServer.listen).bind(this.sdpServer)(sdp, address);
        this.emit('start');
        return this;
    }

    public async stop() {
        await promisify(this.httpServer.close).bind(this.httpServer)();
        await Promise.all(this.links.map(({ scpClient }) => scpClient.connected && promisify(scpClient.close).bind(scpClient)()));
        await promisify(this.scpServer.close).bind(this.scpServer)();
        await promisify(this.sdpServer.close).bind(this.sdpServer)();
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