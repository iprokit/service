// Import Libs.
import { EventEmitter, once } from 'events';
import { promises as Stream } from 'stream';
import { AddressInfo } from 'net';

// Import @iprolab Libs.
import { Socket, Incoming, Outgoing } from '@iprolab/scp';

// Import Local.
import { RFI, Mode } from './scp';
import Conductor from './scp.conductor';

/**
 * Implements a simple SCP Client.
 * Manages connection persistence to the server.
 * 
 * @emits `connect` when the connection is successfully established.
 * @emits `<operation>` when a broadcast is received.
 * @emits `error` when an error occurs.
 * @emits `close` when the connection is closed.
 */
export default class Client extends EventEmitter implements IClient {
    /**
     * Unique identifier of the client.
     */
    public readonly identifier: string;

    /**
     * `true` when the client is connected, `false` when destroyed.
     */
    private _connected: boolean;

    /**
     * Underlying SCP Socket.
     */
    private _socket!: Socket;

    /**
     * Creates an instance of SCP `Client`.
     * 
     * @param identifier unique identifier of the client.
     */
    constructor(identifier: string) {
        super();

        // Initialize options.
        this.identifier = identifier;

        // Initialize variables.
        this._connected = false;

        // Bind listeners.
        this.onConnect = this.onConnect.bind(this);
        this.onIncoming = this.onIncoming.bind(this);
        this.onError = this.onError.bind(this);
        this.onEnd = this.onEnd.bind(this);
        this.onClose = this.onClose.bind(this);
    }

    //////////////////////////////
    //////// Gets/Sets
    //////////////////////////////
    /**
     * `true` when the client is connected, `false` otherwise.
     */
    public get connected() {
        return this._connected;
    }

    /**
     * Remote address of the client.
     */
    public get remoteAddress() {
        return this._socket?.remoteAddress;
    }

    /**
     * Local address of the client.
     */
    public get localAddress() {
        return this._socket?.localAddress;
    }

    /**
     * Remote port of the client.
     */
    public get remotePort() {
        return this._socket?.remotePort;
    }

    /**
     * Local port of the client.
     */
    public get localPort() {
        return this._socket?.localPort;
    }

    /**
     * Remote family of the client.
     */
    public get remoteFamily() {
        return this._socket?.remoteFamily;
    }

    /**
     * Retrieves the bound address, family, and port of the client as reported by operating system.
     */
    public address() {
        return (this._socket && this.connected) ? this._socket.address() as AddressInfo : null;
    }

    //////////////////////////////
    //////// Event Listeners
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
        if (incoming.mode === Mode.SUBSCRIBE) {
            this._socket.emit('subscribe', incoming);
        } else if (incoming.mode === Mode.BROADCAST) {
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
     * FIN packet is received. Ending writable operations on the socket.
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
    //////// Subscribe
    //////////////////////////////
    /**
     * Subscribes to the server to receive broadcasts.
     */
    private async subscribe() {
        let incoming!: Incoming;
        let outgoing!: Outgoing;

        try {
            // Write: Outgoing stream.
            outgoing = await new Promise((resolve) => this._socket.createOutgoing((outgoing) => resolve(outgoing)));
            outgoing.setRFI(new RFI(Mode.SUBSCRIBE, '', { 'CID': this.identifier }));
            outgoing.end('');
            await Stream.finished(outgoing);

            // Read: Incoming stream.
            [incoming] = await once(this._socket, 'subscribe');
            incoming.resume();
            await Stream.finished(incoming);
        } catch (error) {
            // ❗️⚠️❗️
            incoming?.destroy();
            outgoing?.destroy();
            (incoming || outgoing).socket.destroy(error as Error);
        }
    }

    //////////////////////////////
    //////// Broadcast
    //////////////////////////////
    /**
     * Process the `Incoming` broadcast stream.
     * 
     * @emits `<operation>` when a broadcast is received.
     */
    private async broadcast(incoming: Incoming) {
        try {
            // No listener was added to the broadcast, Drain the stream. Move on to the next one.
            if (this.listenerCount(incoming.operation) === 0) {
                incoming.resume();
                await Stream.finished(incoming);
                return;
            }

            // ✅
            if (incoming.get('FORMAT') === 'OBJECT') {
                // Read: Incoming stream.
                let data = '';
                for await (const chunk of incoming) {
                    data += chunk;
                }
                this.emit(incoming.operation, ...JSON.parse(data));
                return;
            }

            // Nothing to see here! 🎤🎧
            this.emit(incoming.operation, incoming);
        } catch (error) {
            // ❗️⚠️❗️
            incoming.destroy();
            incoming.socket.destroy(error as Error);
        }
    }

    //////////////////////////////
    //////// IClient
    //////////////////////////////
    public Socket() {
        // Ohooomyyy 🤦.
        if (!this.connected) throw new Error('SCP_CLIENT_INVALID_CONNECTION');

        // Create socket.
        const socket = new Socket({ emitIncoming: false });
        socket.once('end', () => socket.destroy());
        socket.connect(this.remotePort!, this.remoteAddress!);

        // Create incoming.
        (socket as any)._incoming = new Incoming(socket);
        socket.incoming.once('end', () => socket.destroy());

        // Create outgoing.
        (socket as any)._outgoing = new Outgoing(socket);

        // Connection. 🔌
        return socket;
    }

    public omni(operation: string, callback: (incoming: Incoming) => void) {
        const { incoming, outgoing } = this.Socket();
        incoming.once('rfi', () => callback(incoming));
        outgoing.setRFI(new RFI(Mode.OMNI, operation, { 'CID': this.identifier }));
        return outgoing;
    }

    public async execute<Returned>(operation: string, ...args: Array<any>) {
        const { incoming, outgoing } = this.Socket();
        outgoing.setRFI(new RFI(Mode.OMNI, operation, { 'CID': this.identifier, 'FORMAT': 'OBJECT' }));

        // Initialize 🎩🚦🔲.
        const conductor = (args.length > 0 && args[args.length - 1] instanceof Conductor) ? (args.pop() as Conductor).setIO(incoming, outgoing) : undefined;
        let incomingData = '', outgoingData = JSON.stringify(args);
        try {
            // Write.
            conductor ? await conductor.writeBlock(outgoingData) : await Stream.finished(outgoing.end(outgoingData));

            // Read.
            await once(incoming, 'rfi'); // Waiting for RFI...🕵️‍♂️
            for await (const chunk of (conductor ?? incoming)) {
                incomingData += chunk;
            }
            conductor || await Stream.finished(incoming);
        } catch (error) {
            // ❗️⚠️❗️
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
    //////// Connection Management
    //////////////////////////////
    /**
     * Initiates a connection to the server.
     * 
     * @param port remote port.
     * @param host remote host.
     * @param callback optional callback added as a one-time listener for the `connect` event.
     */
    public connect(port: number, host: string, callback?: () => void) {
        callback && this.once('connect', callback);

        // Setup Socket.
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
     * Closes connection to the server.
     * 
     * @param callback optional callback added as a one-time listener for the `close` event.
     */
    public close(callback?: () => void) {
        if (!this._socket) return this;

        callback && this.once('close', callback);
        this._socket.destroy();
        return this;
    }

    //////////////////////////////
    //////// Ref/Unref
    //////////////////////////////
    /**
     * References the socket, preventing it from closing automatically.
     * Calling `ref` again has no effect if already referenced.
     */
    public ref() {
        this._socket?.ref();
        return this;
    }

    /**
     * Unreferences the socket, allowing it to close automatically when no other event loop activity is present.
     * Calling `unref` again has no effect if already unreferenced.
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
 * Interface for the SCP `Client`.
 */
export interface IClient {
    /**
     * Returns a `Socket` that is connected and configured with single-use `Incoming` and `Outgoing` stream.
     */
    Socket: () => Socket;

    /**
     * Creates an `Outgoing` stream to send data and an `Incoming` stream to receive data from the server.
     * 
     * @param operation operation pattern.
     * @param callback called when data is available on the `Incoming` stream.
     */
    omni: (operation: string, callback: (incoming: Incoming) => void) => Outgoing;

    /**
     * Executes an asynchronous remote function on the server and returns a promise resolving to a result.
     * Pass a `Conductor` as the final argument to handle signals.
     * 
     * @param operation operation pattern.
     * @param args arguments to be passed to the remote function.
     */
    execute: <Returned>(operation: string, ...args: Array<any>) => Promise<Returned> | Returned;
}