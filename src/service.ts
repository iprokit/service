//Import Libs.
import { EventEmitter, once } from 'events';
import { AddressInfo } from 'net';

//Import @iprotechs Libs.
import { Params } from '@iprotechs/scp';
import { Pod } from '@iprotechs/sdp';

//Import Local.
import HttpServer, { RequestHandler } from './http.server';
import ScpServer from './scp.server';
import ScpClient from './scp.client';
import SdpServer from './sdp.server';
import Utilities, { ProxyOptions, ReplyFunction } from './utilities';

export default class Service extends EventEmitter {
    public readonly identifier: string;

    public readonly httpServer: HttpServer;
    public readonly scpServer: ScpServer;
    public readonly sdpServer: SdpServer;

    public readonly links: Map<string, Link>;

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
    private onAvailable(pod: Pod) {
        const link = this.links.get(pod.identifier);
        if (!link) return;

        //Establish connection.
        link.proxyOptions.port = Number(pod.get('http')), link.proxyOptions.host = pod.get('host');
        link.scpClient.connect(Number(pod.get('scp')), pod.get('host'));
        this.emit('link', link);
    }

    private onUnavailable(pod: Pod) {
        const link = this.links.get(pod.identifier);
        if (!link) return;

        //Terminate connection.
        link.proxyOptions.port = undefined, link.proxyOptions.host = undefined;
        link.scpClient.connected && link.scpClient.close();
        this.emit('unlink', link);
    }

    //////////////////////////////
    //////Link
    //////////////////////////////
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
        const link = this.links.get(identifier);
        if (!link) throw new Error('SERVICE_LINK_INVALID_IDENTIFIER');

        //Proxy(📬)
        this.all(path, Utilities.proxy(link.proxyOptions));
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
        const link = this.links.get(identifier);
        if (!link) throw new Error('SERVICE_LINK_INVALID_IDENTIFIER');

        //Message(📩)
        return await Utilities.message<Reply>(link.scpClient, operation, ...message);
    }

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
    public async start(http: number, scp: number, sdp: number, address: string) {
        //HTTP
        this.httpServer.listen(http);
        await once(this.httpServer, 'listening');

        //SCP
        this.scpServer.listen(scp);
        await once(this.scpServer, 'listening');

        //SDP
        this.sdpServer.attrs.set('http', String(http));
        this.sdpServer.attrs.set('scp', String(scp));
        this.sdpServer.listen(sdp, address);
        await once(this.sdpServer, 'listening');

        //Link
        await Promise.all(Array.from(this.links.values()).map(({ scpClient }) => !scpClient.connected && once(scpClient, 'connect')));

        this.emit('start');
        return this;
    }

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
export interface Link {
    proxyOptions: ProxyOptions;
    scpClient: ScpClient;
}