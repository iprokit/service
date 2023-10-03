//Import @iprotechs Libs.
import { Pod, Attrs, Socket, Sender } from '@iprotechs/sdp';

export default class SdpServer extends Socket {
    public readonly selfPod: Pod;
    public readonly pods: Array<Pod>;

    private _localAddress: string;
    private _multicastAddress: string;

    constructor(identifier: string) {
        super();

        //Initialize Options.
        this.selfPod = new Pod(identifier, null);

        //Initialize Variables.
        this.pods = new Array();

        //Bind listeners.
        this.onPod = this.onPod.bind(this);

        //Add listeners.
        this.addListener('pod', this.onPod);
    }

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    public get identifier() {
        return this.selfPod.identifier;
    }

    public get localAddress() {
        return this._localAddress ?? null;
    }

    public get multicastAddress() {
        return this._multicastAddress ?? null;
    }

    public get listening() {
        return this.bound;
    }

    //////////////////////////////
    //////Event Listeners
    //////////////////////////////
    private onPod(pod: Pod, sender: Sender) {
        //Pod echo.
        if (pod.identifier === this.identifier) {
            this._localAddress = pod.available ? sender.address : undefined;
            this.emit('echo');
            return;
        }

        const index = this.pods.findIndex(({ identifier }) => identifier === pod.identifier);
        pod.attrs.address = sender.address; //Copy address to pod.

        //Pod discover.
        if (index === -1) {
            this.pods.push(pod);
            this.multicast(true, () => this.emit('discover', pod));
        }

        //Pod update.
        if (index >= 0) {
            if (this.pods[index].available !== pod.available) {
                this.pods[index] = pod;
                this.emit('update', pod);
            }
        }
    }

    //////////////////////////////
    //////Multicast
    //////////////////////////////
    private multicast(available: boolean, callback: () => void) {
        this.selfPod.available = available;
        this.send(this.selfPod, this.address().port, this.multicastAddress, (error: Error) => {
            if (error) return; /* LIFE HAPPENS!!! */

            this.once('echo', callback);
        });
    }

    //////////////////////////////
    //////Configuration
    //////////////////////////////
    private configure(multicast: string, attrs: Attrs) {
        this._multicastAddress = multicast;
        this.addMembership(this.multicastAddress);
        this.selfPod.attrs = attrs;
    }

    private deconfigure() {
        this.selfPod.attrs = {};
        this.removeMembership(this.multicastAddress);
        this._multicastAddress = undefined;
    }

    //////////////////////////////
    //////Connection Management
    //////////////////////////////
    public listen(port: number, multicast: string, attrs: Attrs, callback?: () => void) {
        callback && this.once('listening', callback);

        this.bind(port, () => {
            this.configure(multicast, attrs);
            this.multicast(true, () => this.emit('listening'));
        });
        return this;
    }

    public close(callback?: () => void) {
        callback && this.once('close', callback);

        this.multicast(false, () => {
            this.deconfigure();
            super.close();
        });
        return this;
    }
}