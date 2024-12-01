// Import Libs.
import { EventEmitter, once } from 'events';
import { promises as Stream } from 'stream';
import { AddressInfo } from 'net';

// Import @iprolab Libs.
import { Socket } from '@iprolab/scp';

// Import Local.
import { RFI, Incoming, Outgoing } from './definitions';
import Orchestrator, { Conductor } from './orchestrator';

/**
 * `Client` manages connections to an SCP server.
 * Once connected, it subscribes to receive broadcasts and handles the executions.
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
        if (incoming.mode === 'SUBSCRIBE') {
            this._socket.emit('subscribe', incoming);
        } else if (incoming.mode === 'BROADCAST') {
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
            outgoing = await new Promise((resolve) => this._socket.createOutgoing((outgoing) => resolve(outgoing as Outgoing)));
            outgoing.setRFI(new RFI('SUBSCRIBE', '', { 'CID': this.identifier }));
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

            // Read: Incoming stream. ✅
            let data = '';
            for await (const chunk of incoming) {
                data += chunk;
            }
            this.emit(incoming.operation, ...JSON.parse(data));
        } catch (error) {
            // ❗️⚠️❗️
            incoming.destroy();
            incoming.socket.destroy(error as Error);
        }
    }

    //////////////////////////////
    //////// IClient
    //////////////////////////////
    public IO(mode: IOMode, operation: string) {
        const { incoming, outgoing } = new IOSocket().connect(this.remotePort!, this.remoteAddress!);
        outgoing.setRFI(new RFI(mode, operation, { 'CID': this.identifier }));
        return { incoming, outgoing }
    }

    public async message<Returned>(operation: string, ...args: Array<any>) {
        const { incoming, outgoing } = this.IO('REPLY', operation);
        let incomingData = '', outgoingData = JSON.stringify(args);
        try {
            // Write: Outgoing stream.
            outgoing.end(outgoingData);
            await Stream.finished(outgoing);

            // Waiting for RFI... ⌛🕵️‍♂️
            await once(incoming, 'rfi');

            // Read: Incoming stream.
            for await (const chunk of incoming) {
                incomingData += chunk;
            }
        } catch (error) {
            // ❗️⚠️❗️
            incoming.destroy();
            outgoing.destroy();
            throw error;
        }

        if (incoming.parameters['STATUS'] === 'ERROR') {
            throw Object.assign(new Error(), JSON.parse(incomingData)) as Error;
        }
        return JSON.parse(incomingData) as Returned;
    }

    public async conduct(operation: string, orchestrator: Orchestrator, ...args: Array<any>) {
        const { incoming, outgoing } = this.IO('CONDUCTOR', operation);
        let outgoingData = JSON.stringify(args);

        // Initialize. 🎩🚦🔲
        const conductor = new Conductor(incoming, outgoing);
        orchestrator.manage(conductor);
        try {
            // Write: Conductor.
            await conductor.deliver(outgoingData);

            // Waiting for RFI... ⌛🕵️‍♂️
            await once(conductor, 'rfi');
        } catch (error) {
            // ❗️⚠️❗️
            conductor.destroy();
            throw error;
        }
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
//////// IClient
//////////////////////////////
/**
 * Interface for the SCP `Client`.
 */
export interface IClient {
    /**
     * Creates an `Outgoing` stream to send data and an `Incoming` stream to receive data from the server.
     * 
     * @param mode mode of the `RFI`.
     * @param operation operation pattern of the `RFI`.
     */
    IO: (mode: IOMode, operation: string) => IO;

    /**
     * Sends a message to the server and returns a promise resolving to a reply.
     * 
     * @param operation operation pattern.
     * @param args arguments to send.
     */
    message: <Returned>(operation: string, ...args: Array<any>) => Promise<Returned> | Returned;

    /**
     * Sends a message to the server and returns a promise that resolves to `void`, enabling the coordination of signals.
     * 
     * @param operation operation pattern.
     * @param orchestrator orchestrator that coordinates signals.
     * @param args arguments to send.
     */
    conduct: (operation: string, orchestrator: Orchestrator, ...args: Array<any>) => Promise<void>;
}

export type IOMode = 'REPLY' | 'CONDUCTOR';

export interface IO {
    incoming: Incoming;
    outgoing: Outgoing;
}

//////////////////////////////
//////// IO Socket
//////////////////////////////
/**
 * Implements a simple SCP IOSocket.
 * Manages a single instance of `Incoming` and `Outgoing` streams,
 * ensuring one-time use with automatic cleanup on stream completion.
 */
export class IOSocket extends Socket {
    /**
     * Creates an instance of SCP `IOSocket`.
     */
    constructor() {
        super({ flow: IOSocket.SINGLE });

        // Add listeners.
        this.once('end', () => this.destroy());
        this.incoming.once('end', () => this.destroy());
    }

    //////////////////////////////
    //////// Gets/Sets
    //////////////////////////////
    public get incoming() {
        return super.incoming as Incoming;
    }

    public get outgoing() {
        return super.outgoing as Outgoing;
    }
}