//Import Libs.
import { EventEmitter, once } from 'events';
import { promises as Stream } from 'stream';
import { AddressInfo } from 'net';

//Import @iprolab Libs.
import { RFI, Socket, Incoming, Outgoing } from '@iprolab/scp';

//Import Local.
import Conductor from './scp.conductor';

/**
 * This class implements a simple SCP Client.
 * A `Client` is responsible for managing connection persistence to the server.
 * 
 * @emits `connect` when the connection is successfully established.
 * @emits `<operation>` when a broadcast is received.
 * @emits `error` when an error occurs.
 * @emits `close` when the connection is closed.
 */
export default class Client extends EventEmitter implements IClient {
    /**
     * The unique identifier of the client.
     */
    public readonly identifier: string;

    /**
     * Returns true when the client is connected, false when destroyed.
     */
    private _connected: boolean;

    /**
     * The underlying SCP Socket.
     */
    private _socket!: Socket;

    /**
     * Creates an instance of SCP client.
     * 
     * @param identifier the unique identifier of the client.
     */
    constructor(identifier: string) {
        super();

        //Initialize Options.
        this.identifier = identifier;

        //Initialize Variables.
        this._connected = false;

        //Bind Listeners.
        this.onConnect = this.onConnect.bind(this);
        this.onIncoming = this.onIncoming.bind(this);
        this.onError = this.onError.bind(this);
        this.onEnd = this.onEnd.bind(this);
        this.onClose = this.onClose.bind(this);
    }

    //////////////////////////////
    //////Gets/Sets
    //////////////////////////////
    /**
     * Returns true when the client is connected, false otherwise.
     */
    public get connected() {
        return this._connected;
    }

    /**
     * The remote address of the client.
     */
    public get remoteAddress() {
        return this._socket?.remoteAddress;
    }

    /**
     * The local address of the client.
     */
    public get localAddress() {
        return this._socket?.localAddress;
    }

    /**
     * The remote port of the client.
     */
    public get remotePort() {
        return this._socket?.remotePort;
    }

    /**
     * The local port of the client.
     */
    public get localPort() {
        return this._socket?.localPort;
    }

    /**
     * The remote family of the client.
     */
    public get remoteFamily() {
        return this._socket?.remoteFamily;
    }

    /**
     * The bound address, the address family name and port of the client as reported by the operating system.
     */
    public address() {
        return (this._socket && this.connected) ? this._socket.address() as AddressInfo : null;
    }

    //////////////////////////////
    //////Event Listeners
    //////////////////////////////
    /**
     * @emits `connect` when the connection is successfully established.
     */
    private onConnect() {
        this.subscribe().then(() => {
            this._connected = true;
            this.emit('connect');
        });
    }

    /**
     * - Subscribe is handled by `subscribe` function.
     * - Broadcast is handled by `broadcast` function.
     */
    private onIncoming(incoming: Incoming) {
        if (incoming.mode === 'SUBSCRIBE' && incoming.operation === 'subscribe') {
            this._socket.emit('subscribe', incoming);
        }
        if (incoming.mode === 'BROADCAST') {
            this.broadcast(incoming);
        }
    }

    /**
     * @emits `error` when an error occurs.
     */
    private onError(error: Error) {
        this.emit('error', error);
    }

    /**
     * FIN packet is received. Ending the writable part of the socket.
     */
    private onEnd() {
        this._socket.destroy();
    }

    /**
     * @emits `close` when the connection is closed.
     */
    private onClose() {
        this._connected = false;
        this.emit('close');
    }

    //////////////////////////////
    //////Subscribe
    //////////////////////////////
    /**
     * Subscribes to the server to receive broadcasts.
     */
    private async subscribe() {
        let incoming!: Incoming;
        let outgoing!: Outgoing;

        try {
            //Write: Outgoing stream.
            outgoing = await new Promise((resolve) => this._socket.createOutgoing((outgoing) => resolve(outgoing)));
            outgoing.setRFI(new RFI('SUBSCRIBE', 'subscribe'));
            outgoing.set('CID', this.identifier);
            outgoing.end('');
            await Stream.finished(outgoing);

            //Read: Incoming stream.
            [incoming] = await once(this._socket, 'subscribe');
            incoming.resume();
            await Stream.finished(incoming);
        } catch (error) {
            //❗️⚠️❗️
            incoming?.destroy();
            outgoing?.destroy();
            (incoming || outgoing).socket.destroy(error as Error);
        }
    }

    //////////////////////////////
    //////Broadcast
    //////////////////////////////
    /**
     * Process the `Incoming` broadcast stream.
     * 
     * @emits `<operation>` when a broadcast is received.
     */
    private async broadcast(incoming: Incoming) {
        try {
            //No listener was added to the broadcast, Drain the stream. Move on to the next one.
            if (this.listenerCount(incoming.operation) === 0) {
                incoming.resume();
                await Stream.finished(incoming);
                return;
            }

            //✅
            if (incoming.params.get('FORMAT') === 'OBJECT') {
                //Read: Incoming stream.
                let data = '';
                for await (const chunk of incoming) {
                    data += chunk;
                }
                this.emit(incoming.operation, ...JSON.parse(data));
                return;
            }

            //Nothing to see here! 🎤🎧
            this.emit(incoming.operation, incoming);
        } catch (error) {
            //❗️⚠️❗️
            incoming.destroy();
            incoming.socket.destroy(error as Error);
        }
    }

    //////////////////////////////
    //////Interface: IClient
    //////////////////////////////
    public Socket() {
        //Ohooomyyy 🤦.
        if (!this.connected) throw new Error('SCP_CLIENT_INVALID_CONNECTION');

        //Create socket.
        const socket = new Socket({ emitIncoming: false });
        socket.once('end', () => socket.destroy());
        socket.connect(this.remotePort as number, this.remoteAddress as string);

        //Create incoming.
        (socket as any)._incoming = new Incoming(socket);
        socket.incoming.once('end', () => socket.destroy());

        //Create outgoing.
        (socket as any)._outgoing = new Outgoing(socket);

        //Connection. 🔌
        return socket;
    }

    public omni(operation: string, callback: (incoming: Incoming) => void) {
        const { incoming, outgoing } = this.Socket();
        incoming.once('rfi', () => callback(incoming));
        outgoing.setRFI(new RFI('OMNI', operation, [['CID', this.identifier]]));
        return outgoing;
    }

    public async execute<Returned>(operation: string, ...args: Array<any>) {
        const { incoming, outgoing } = this.Socket();
        outgoing.setRFI(new RFI('OMNI', operation, [['CID', this.identifier], ['FORMAT', 'OBJECT']]));

        //Initialize 🎩🚦🔲.
        const conductor = (args.length > 0 && args[args.length - 1] instanceof Conductor) ? args.pop() as Conductor : undefined;
        if (conductor) {
            conductor.assign(incoming, outgoing);
            outgoing.set('CONDUCTOR', 'TRUE');
        }

        let incomingData = '', outgoingData = JSON.stringify(args);
        try {
            //Write.
            await (conductor ? conductor.writeBlock(outgoingData) : Stream.finished(outgoing.end(outgoingData)));

            //Read.
            await once(incoming, 'rfi');
            for await (const chunk of (conductor ?? incoming)) {
                incomingData += chunk;
            }
        } catch (error) {
            //❗️⚠️❗️
            incoming.destroy();
            outgoing.destroy();
            throw error;
        }

        if (incoming.get('STATUS') === 'ERROR') {
            throw Object.assign(new Error(), JSON.parse(incomingData)) as Error;
        }
        return JSON.parse(incomingData) as Returned;
    }

    //////////////////////////////
    //////Connection Management
    //////////////////////////////
    /**
     * Initiate the connection to the server.
     * 
     * @param port the remote port.
     * @param host the remote host.
     * @param callback the optional callback will be added as a listener for the `connect` event once.
     */
    public connect(port: number, host: string, callback?: () => void) {
        callback && this.once('connect', callback);

        //Setup Socket.
        this._socket = new Socket();
        this._socket.addListener('connect', this.onConnect);
        this._socket.addListener('incoming', this.onIncoming);
        this._socket.addListener('error', this.onError);
        this._socket.addListener('end', this.onEnd);
        this._socket.addListener('close', this.onClose);
        this._socket.setKeepAlive(true);
        this._socket.connect(port, host);
        return this;
    }

    /**
     * Closes the connection to the server.
     * 
     * @param callback the optional callback will be added as a listener for the `close` event once.
     */
    public close(callback?: () => void) {
        if (!this._socket) return this;

        callback && this.once('close', callback);
        this._socket.destroy();
        return this;
    }

    //////////////////////////////
    //////Ref/Unref
    //////////////////////////////
    /**
     * Ref the socket.
     * If the socket is refed calling ref again will have no effect.
     */
    public ref() {
        this._socket?.ref();
        return this;
    }

    /**
     * Unref the socket.
     * If the socket is unrefed calling unref again will have no effect.
     */
    public unref() {
        this._socket?.unref();
        return this;
    }
}

//////////////////////////////
/////IClient
//////////////////////////////
/**
 * Interface of SCP `Client`.
 */
export interface IClient {
    /**
     * Returns a `Socket` that is connected and configured with single-use `Incoming` and `Outgoing` streams.
     */
    Socket: () => Socket;

    /**
     * Creates an `Outgoing` stream to send data and an `Incoming` stream to receive data from the server.
     * 
     * @param operation the operation pattern.
     * @param callback called when data is available on the `Incoming` stream.
     */
    omni: (operation: string, callback: (incoming: Incoming) => void) => Outgoing;

    /**
     * Executes a remote function on the server and returns a promise that resolves to the returned value.
     * 
     * @param operation the operation pattern.
     * @param args the arguments to be passed to the remote function.
     */
    execute: <Returned>(operation: string, ...args: Array<any>) => Promise<Returned> | Returned;
}