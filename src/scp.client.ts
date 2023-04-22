//Import Libs.
import { EventEmitter, once } from 'events';
import { finished } from 'stream';

//Import @iprotechs Libs.
import { RFI, Socket, Incoming, Outgoing } from '@iprotechs/scp';

//Import Local.
import Helper from './helper';

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
     * Creates an instance of Client.
     * 
     * @param identifier the unique identifier of the client.
     */
    constructor(identifier: string) {
        super();

        //Initialize Options.
        this.identifier = identifier;

        //Initialize Functions.
        this.bindListeners();
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
        return this._socket?.address();
    }

    //////////////////////////////
    //////Event Management
    //////////////////////////////
    /**
     * Bind event listeners.
     */
    private bindListeners() {
        this.onConnect = this.onConnect.bind(this);
        this.onIncoming = this.onIncoming.bind(this);
        this.onError = this.onError.bind(this);
        this.onEnd = this.onEnd.bind(this);
        this.onClose = this.onClose.bind(this);
    }

    /**
     * Add event listeners to SCP socket.
     */
    private addListeners() {
        this._socket.addListener('connect', this.onConnect);
        this._socket.addListener('incoming', this.onIncoming);
        this._socket.addListener('error', this.onError);
        this._socket.addListener('end', this.onEnd);
        this._socket.addListener('close', this.onClose);
    }

    //////////////////////////////
    //////Event Listeners
    //////////////////////////////
    /**
     * @emits `connect` when the connection is successfully established.
     */
    private onConnect() {
        this.subscribe((error?: Error) => {
            if (error) return;

            this._connected = true;
            this.emit('connect');
        });
    }

    /**
     * - Subscribe is handled by `subscribe` function.
     * - Broadcast is handled by `broadcast` function.
     */
    private onIncoming(incoming: Incoming) {
        if (incoming.isReply() && incoming.map === 'SCP.subscribe') {
            this._socket.emit('subscribe', incoming);
        }
        if (incoming.isBroadcast()) {
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
        //Read: Reply from incoming stream.
        this._socket.once('subscribe', async (incoming: Incoming) => {
            try {
                for await (const chunk of incoming) { }
                callback();
            } catch (error) {
                callback(error);
            }
        });

        //Write: Message to outgoing stream.
        this._socket.createOutgoing((outgoing: Outgoing) => {
            finished(outgoing, (error) => error && callback(error));
            outgoing.setRFI(RFI.createReply('SCP.subscribe'));
            outgoing.setParam('RFID', Helper.generateRFID());
            outgoing.setParam('CID', this.identifier);
            outgoing.end('');
        });
    }

    //////////////////////////////
    //////Message
    //////////////////////////////
    /**
     * Creates an `Outgoing` stream to send a message and an `Incoming` stream to receive a reply from remote reply function.
     * 
     * @param map the map of the remote reply function.
     * @param callback called when the reply is available on the `Incoming` stream.
     */
    public createMessage(map: string, callback?: (incoming: Incoming) => void) {
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
        socket.outgoing.setRFI(RFI.createReply(map));
        socket.outgoing.setParam('RFID', Helper.generateRFID());
        socket.outgoing.setParam('CID', this.identifier);
        return socket.outgoing;
    }

    /**
     * Sends a message to the remote reply function and returns a promise that resolves to the reply received.
     * 
     * @param map the map of the remote reply function.
     * @param message the message to send.
     */
    public message<Reply>(map: string, ...message: Array<any>) {
        return new Promise<Reply>(async (resolve, reject) => {
            //Read: Reply from incoming stream.
            const outgoing = this.createMessage(map, async (incoming) => {
                try {
                    let chunks = '';
                    for await (const chunk of incoming) {
                        chunks += chunk;
                    }

                    if (incoming.getParam('STATUS') === 'OK') {
                        resolve(JSON.parse(chunks));
                    }
                    if (incoming.getParam('STATUS') === 'ERROR') {
                        const error = new Error();
                        Object.assign(error, JSON.parse(chunks));
                        reject(error);
                    }
                } catch (error) {
                    reject(error);
                }
            });

            //Write: Message to outgoing stream.
            finished(outgoing, (error) => error && reject(error));
            outgoing.setParam('FORMAT', 'OBJECT');
            if (!outgoing.write(JSON.stringify(message))) {
                await once(outgoing, 'drain');
            }
            outgoing.end();
        });
    }

    //////////////////////////////
    //////Broadcast
    //////////////////////////////
    /**
     * Process the incoming broadcast stream.
     */
    private broadcast(incoming: Incoming) {
        //No listener was added to the broadcast, Drain the stream. Move on to the next one.
        if (this.listenerCount(incoming.map) === 0) {
            finished(incoming, (error) => { /* LIFE HAPPENS!!! */ });
            incoming.resume();
            return;
        }

        //Looks like the broadcast is not an object, Consumer needs to handle it!
        if (incoming.getParam('FORMAT') !== 'OBJECT') {
            this.emit(incoming.map, incoming);
            return;
        }

        //Read: Broadcast from incoming stream.
        (async () => {
            try {
                let chunks = '';
                for await (const chunk of incoming) {
                    chunks += chunk;
                }
                this.emit(incoming.map, ...JSON.parse(chunks));
            } catch (error) {
                /* LIFE HAPPENS!!! */
            }
        })();
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
        this.initSocket();
        this._socket.connect(port, host);
        return this;
    }

    /**
     * Closes the connection to the server.
     * 
     * @param callback the optional callback will be added as a listener for the `close` event once.
     */
    public close(callback?: () => void) {
        callback && this.once('close', callback);
        this._socket.destroy();
        return this;
    }

    //////////////////////////////
    //////Helpers
    //////////////////////////////
    /**
     * Initializes the socket.
     */
    private initSocket() {
        this._socket = new Socket();
        this._socket.setKeepAlive(true);
        this._connected = false;
        this.addListeners();
    }
}