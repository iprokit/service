//Import Libs.
import { EventEmitter, once } from 'events';

//Import @iprotechs Libs.
import { Pod, Args, Discovery } from '@iprotechs/discovery';

//Import Local.
import HttpServer from './http.server';
import ScpServer from './scp.server';
import ScpClient from './scp.client';

export default class Service extends EventEmitter {
    public readonly identifier: string;

    public readonly remoteServices: Array<RemoteService>;

    public readonly httpServer: HttpServer;
    public readonly scpServer: ScpServer;
    public readonly discovery: Discovery;

    constructor(identifier: string) {
        super();

        //Initialize Options.
        this.identifier = identifier;

        //Initialize Variables.
        this.remoteServices = new Array();
        this.httpServer = new HttpServer();
        this.scpServer = new ScpServer(this.identifier);
        this.discovery = new Discovery();

        //Bind Listeners.
        this.onDiscover = this.onDiscover.bind(this);

        //Add Listeners.
        this.discovery.addListener('discover', this.onDiscover);
    }

    //////////////////////////////
    //////Event Listeners
    //////////////////////////////
    private async onDiscover(pod: Pod) {
        const { identifier, args } = pod;
        const { http, scp, host } = args;

        const remoteService = this.register(identifier);
        remoteService.link(Number(http), host);
        remoteService.connect(Number(scp), host);
        await once(remoteService, 'connect');
        this.emit('remoteService', remoteService);
    }

    //////////////////////////////
    //////Register
    //////////////////////////////
    public register(identifier: string) {
        const remoteService = new RemoteService(identifier);
        this.remoteServices.push(remoteService);
        return remoteService;
    }

    //////////////////////////////
    //////Start/Stop
    //////////////////////////////
    public async start(httpPort: number, scpPort: number, discoveryPort: number, discoveryHost: string, localHost: string) {
        const discoveryArgs: Args = { http: String(httpPort), scp: String(scpPort), host: localHost }

        this.httpServer.listen(httpPort);
        await once(this.httpServer, 'listening');

        this.scpServer.listen(scpPort);
        await once(this.scpServer, 'listening');

        this.discovery.bind(discoveryPort, discoveryHost, this.identifier, discoveryArgs);
        await once(this.discovery, 'listening');

        this.emit('start');
        return this;
    }

    public async stop() {
        this.httpServer.close();
        await once(this.httpServer, 'close');

        await Promise.all(this.remoteServices.map(async (remoteService) => {
            remoteService.close();
            await once(remoteService, 'close');
        }));

        this.scpServer.close();
        await once(this.scpServer, 'close');

        this.discovery.close();
        await once(this.discovery, 'close');

        this.emit('stop');
        return this;
    }
}

//////////////////////////////
//////RemoteService
//////////////////////////////
export class RemoteService extends ScpClient {
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