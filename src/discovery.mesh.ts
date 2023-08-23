//Import @iprotechs Libs.
import { Pod, Args, Discovery } from '@iprotechs/discovery';

//Import Local.
import Client from './scp.client';

export default class DiscoveryMesh extends Discovery {
    public readonly nodes = new Array<Node>();

    constructor() {
        super();

        //Initialize Variables.
        this.nodes = new Array();

        //Bind Listeners.
        this.onDiscover = this.onDiscover.bind(this);

        //Add Listeners.
        this.addListener('discover', this.onDiscover);
    }

    //////////////////////////////
    //////Event Listeners
    //////////////////////////////
    private onDiscover(pod: Pod) {
        const { identifier, args } = pod;
        const { http, scp, host } = args;

        const node = this.register(identifier);
        node.link(Number(http), host);
        // node.connect(Number(scp), host);
        this.emit('node', node);
    }

    //////////////////////////////
    //////Register
    //////////////////////////////
    public register(identifier: string) {
        const node = new Node(identifier);
        this.nodes.push(node);
        return node;
    }

    //////////////////////////////
    //////Connection Management
    //////////////////////////////
    public join(port: number, address: string, identifier: string, joinArgs: JoinArgs, callback?: () => void) {
        const args: Args = { http: String(joinArgs.http), scp: String(joinArgs.scp), host: joinArgs.host }
        this.bind(port, address, identifier, args, callback);
        return this;
    }
}

//////////////////////////////
//////JoinArgs
//////////////////////////////
export interface JoinArgs {
    http: number;
    scp: number;
    host: string;
}

//////////////////////////////
//////Node
//////////////////////////////
export class Node extends Client {
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