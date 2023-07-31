//Import @iprotechs Libs.
import { Discovery, Pod } from '@iprotechs/discovery';

//Import Local.
import Client from './scp.client';

export default class DiscoveryLink extends Discovery {
    public readonly remoteServices = new Array<RemoteService>();

    constructor(identifier: string, args: LinkArgs) {
        super(identifier, { http: String(args.http), scp: String(args.scp), host: args.host });

        //Initialize Variables.
        this.remoteServices = new Array();

        //Bind Listeners.
        this.onDiscover = this.onDiscover.bind(this);

        //Add Listeners.
        this.addListener('discover', this.onDiscover);
    }

    //////////////////////////////
    //////Event Listeners
    //////////////////////////////
    private async onDiscover(pod: Pod) {
        const { identifier, args } = pod;
        const { http, scp, host } = args;

        this.register(identifier, Number(http), Number(scp), host);
    }

    //////////////////////////////
    //////Register
    //////////////////////////////
    public register(identifier: string, http: number, scp: number, host: string, callback?: () => void) {
        const remoteService = new RemoteService(identifier);
        remoteService.link(http, scp, host, callback);
        this.remoteServices.push(remoteService);
        return this;
    }
}

export interface LinkArgs {
    http: number;
    scp: number;
    host: string;
}

export class RemoteService extends Client {
    public httpPort: number;

    public link(http: number, scp: number, host: string, callback?: () => void) {
        this.httpPort = http;
        this.connect(scp, host, callback);
        return this;
    }
}