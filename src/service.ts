//Import Libs.
import { EventEmitter } from 'events';
import { promisify } from 'util';

//Import @iprotechs Libs.
import { Pod, Args, Discovery } from '@iprotechs/discovery';

//Import Local.
import HttpServer, { RequestHandler } from './http.server';
import ScpServer, { RemoteFunctionHandler, ReplyFunction } from './scp.server';
import ScpClient from './scp.client';
import { localAddress } from './common';

export default class Service extends EventEmitter {
    public readonly identifier: string;

    public readonly nodes: Array<Node>;

    public readonly httpServer: HttpServer;
    public readonly scpServer: ScpServer;
    public readonly discovery: Discovery;

    constructor(identifier: string) {
        super();

        //Initialize Options.
        this.identifier = identifier;

        //Initialize Variables.
        this.nodes = new Array();
        this.httpServer = new HttpServer();
        this.scpServer = new ScpServer(this.identifier);
        this.discovery = new Discovery();

        //Bind Listeners.
        this.onDiscover = this.onDiscover.bind(this);

        //Add Listeners.
        this.discovery.addListener('discover', this.onDiscover);
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
        return { http: this.httpServer.listening, scp: this.scpServer.listening, discovery: this.discovery.listening }
    }

    //////////////////////////////
    //////Event Listeners
    //////////////////////////////
    private async onDiscover(pod: Pod) {
        const { identifier, args } = pod;
        const { http, scp, host } = args;

        const node = this.createNode(identifier);
        node.link(Number(http), host);
        await promisify(node.connect).bind(node)(Number(scp), host);
        this.emit('node', node);
    }

    //////////////////////////////
    //////Node
    //////////////////////////////
    public createNode(identifier: string) {
        let node = this.getNode(identifier);
        if (node)
            return node;

        node = new Node(identifier);
        this.nodes.push(node);
        return node;
    }

    public getNode(identifier: string) {
        return this.nodes.find(node => node.identifier === identifier);
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
    //////SCP
    //////////////////////////////
    public createReply(map: string, handler: RemoteFunctionHandler) {
        this.scpServer.createReply(map, handler);
        return this;
    }

    public reply<Reply>(map: string, replyFunction: ReplyFunction<Reply>) {
        this.scpServer.reply(map, replyFunction);
        return this;
    }

    public broadcast(map: string, ...payload: Array<any>) {
        this.scpServer.broadcast(map, ...payload);
        return this;
    }

    //////////////////////////////
    //////Start/Stop
    //////////////////////////////
    public async start(httpPort: number, scpPort: number, discoveryPort: number, discoveryHost: string) {
        const discoveryArgs: Args = { http: String(httpPort), scp: String(scpPort), host: localAddress() }

        await promisify(this.httpServer.listen).bind(this.httpServer)(httpPort);
        await promisify(this.scpServer.listen).bind(this.scpServer)(scpPort);
        await promisify(this.discovery.bind).bind(this.discovery)(discoveryPort, discoveryHost, this.identifier, discoveryArgs);
        this.emit('start');
        return this;
    }

    public async stop() {
        await promisify(this.httpServer.close).bind(this.httpServer)();
        await Promise.all(this.nodes.map(async (node) => await promisify(node.close).bind(node)()));
        await promisify(this.scpServer.close).bind(this.scpServer)();
        await promisify(this.discovery.close).bind(this.discovery)();
        this.emit('stop');
        return this;
    }
}

//////////////////////////////
//////Node
//////////////////////////////
export class Node extends ScpClient {
    private _linkAddress: string;
    private _linkPort: number;

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    public get linkAddress() {
        return this._linkAddress;
    }

    public get linkPort() {
        return this._linkPort;
    }

    //////////////////////////////
    //////Connection Management
    //////////////////////////////
    public link(port: number, host: string) {
        this._linkPort = port;
        this._linkAddress = host;
        return this;
    }
}