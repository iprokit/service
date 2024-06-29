//Import Libs.
import { EventEmitter } from 'events';
import Stream from 'stream';
import { AddressInfo } from 'net';

//Import @iprotechs Libs.
import { RFI, Params, Socket, Incoming, Outgoing } from '@iprotechs/scp';

/**
 * This class implements a simple SCP Client.
 * A `Client` is responsible for managing connection persistence to the server.
 * 
 * @emits `connect` when the connection is successfully established.
 * @emits `error` when an error occurs.
 * @emits `close` when the connection is closed.
 */
export default class Client extends EventEmitter {
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
    private _socket: Socket;

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
        this.subscribe((error?: Error) => {
            if (error) return; /* LIFE HAPPENS!!! */

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
     * 
     * @param callback called once the subscription is complete.
     */
    private subscribe(callback: (error?: Error) => void) {
        //Read: Incoming stream.
        this._socket.once('subscribe', (incoming: Incoming) => {
            Stream.finished(incoming, (error) => callback(error));
            incoming.resume();
        });

        //Write: Outgoing stream.
        this._socket.createOutgoing((outgoing: Outgoing) => {
            Stream.finished(outgoing, (error) => error && callback(error));
            outgoing.setRFI(new RFI('SUBSCRIBE', 'subscribe'));
            outgoing.set('CID', this.identifier);
            outgoing.end('');
        });
    }

    //////////////////////////////
    //////Broadcast
    //////////////////////////////
    /**
     * Process the `Incoming` broadcast stream.
     */
    private broadcast(incoming: Incoming) {
        //No listener was added to the broadcast, Drain the stream. Move on to the next one.
        if (this._socket.listenerCount(incoming.operation) === 0) {
            Stream.finished(incoming, (error) => { /* LIFE HAPPENS!!! */ });
            incoming.resume();
            return;
        }

        //Read: Incoming stream.
        (async () => {
            try {
                let data = '';
                for await (const chunk of incoming) {
                    data += chunk;
                }
                this._socket.emit(incoming.operation, data, incoming.params);
            } catch (error) { /* LIFE HAPPENS!!! */ }
        })();
    }

    /**
     * Registers a listener for broadcast from the server.
     * 
     * @param operation the operation pattern.
     * @param listener the listener called when broadcast data is received.
     */
    public onBroadcast(operation: string, listener: (data: string, params: Params) => void) {
        this._socket.addListener(operation, listener);
        return this;
    }

    //////////////////////////////
    //////Omni
    //////////////////////////////
    /**
     * Creates an `Outgoing` stream to send data and an `Incoming` stream to receive data from the server.
     * 
     * @param operation the operation pattern.
     * @param callback called when data is available on the `Incoming` stream.
     */
    public omni(operation: string, callback: (incoming: Incoming) => void) {
        //Ohooomyyy 🤦.
        if (!this.connected) throw new Error('SCP_CLIENT_INVALID_CONNECTION');

        //Create socket.
        const socket = new Socket({ emitIncoming: false });
        socket.on('end', () => socket.destroy());
        socket.connect(this.remotePort, this.remoteAddress);

        //Create incoming.
        (socket as any)._incoming = new Incoming(socket);
        socket.incoming.on('rfi', () => callback(socket.incoming));
        socket.incoming.on('end', () => socket.destroy());

        //Create outgoing.
        (socket as any)._outgoing = new Outgoing(socket);
        socket.outgoing.setRFI(new RFI('OMNI', operation));
        socket.outgoing.set('CID', this.identifier);
        return socket.outgoing;
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