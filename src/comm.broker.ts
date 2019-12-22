//Import modules
import { EventEmitter } from 'events';
import { Server as MqttServer, Packet, Client } from 'mosca';

//Local Imports
import { Server, Events, Defaults, ConnectionState } from './microservice';
import { Comm, CommMethod, Topic, Message, Reply, MessageParms, ReplyBody, ReplyError, Transaction, Publisher, Broadcast } from './comm';

//Types: CommHandler
export declare type CommHandler = ReplyHandler | TransactionHandler;
export declare type ReplyHandler = (message: BrokerMessage, reply: BrokerReply) => void;
export declare type TransactionHandler = (message: BrokerMessage, transaction: Transaction) => void;

export default class CommBroker extends EventEmitter implements Server {
    //Broker Variables.
    public readonly name: string;
    public readonly port: number;

    //MQTT Server
    private _mqttServer: MqttServer;

    //Topic
    public readonly broadcastTopic: Topic;
    public readonly comms: Array<BrokerComm>;

    //Comm Handler Events
    private readonly _commHandlers: EventEmitter;

    //Publishers
    private readonly _publisherComms: Array<{publisher: typeof Publisher, comms: Array<BrokerComm>}>;
    private readonly _serviceComms: Array<BrokerComm>;

    //Default Constructor
    constructor(){
        //Call super for EventEmitter.
        super();

        //Init Broker variables.
        this.name = global.service.name;
        this.port = Number(process.env.COM_BROKER_PORT) || Defaults.COMM_PORT;

        //Init Topic.
        this.broadcastTopic = Defaults.BROADCAST_TOPIC;
        this.comms = new Array();

        //Init Comm Handler Events
        this._commHandlers = new EventEmitter();

        //Init Variables.
        this._publisherComms = new Array();
        this._serviceComms = new Array();
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public addPublisherComm(method: CommMethod, topic: Topic, publisher: typeof Publisher, handler: CommHandler){
        //Sub function to add Publisher to _publisherComms
        const _addPublisherComm = () => {
            //Create new comms.
            const comms = new Array({ method: method, topic: topic, handler: handler });
    
            //Push Publisher & comms to _publisherComms.
            this._publisherComms.push({publisher: publisher, comms: comms});

            //Emit Publisher added event.
            this.emit(Events.BROKER_ADDED_PUBLISHER, publisher.name, publisher);
        }

        //Validate if _publisherComms is empty.
        if(this._publisherComms.length === 0){
            _addPublisherComm();
        }else{
            //Find existing publisherComm.
            const publisherComm = this._publisherComms.find(stack => stack.publisher.name === publisher.name);

            if(publisherComm){ //publisherComm exists. 
                publisherComm.comms.push({method: method, topic: topic, handler: handler});
            }else{  //No publisherComm found.
                _addPublisherComm();
            }
        }
    }

    private createServiceComms(){
        //Clone all comms from comms to _serviceComms.
        this.comms.forEach(comm => {
            this._serviceComms.push(comm);
        })

        //Get all comms from publisher comms
        this._publisherComms.forEach(stack => {
            stack.comms.forEach(pComm => {
                //Remove publisher comms from serviceComms.
                this._serviceComms.splice(this._serviceComms.findIndex(sComm => JSON.stringify(sComm) === JSON.stringify(pComm)), 1);
            });
        });
    }

    /////////////////////////
    ///////Connection Management
    /////////////////////////
    public async listen(){
        return new Promise<ConnectionState>((resolve, reject) => {
            //Load Service Comms
            this.createServiceComms();

            //Start Server
            this._mqttServer = new MqttServer({ id: this.name, port: this.port });

            //Listen to events.
            this._mqttServer.on('ready', () => {
                this.emit(Events.BROKER_STARTED, this);
                resolve(1);
            });

            this._mqttServer.on('subscribed', (topic: any, client: Client) => {
                //Broadcast
                if(topic === this.broadcastTopic){
                    this.sendBroadcast();
                }
            });

            this._mqttServer.on('published', (packet: Packet, client: Client) => {
                const topic = packet.topic;
                if (!topic.includes('$SYS/')) { //Ignoring all default $SYS/ topics.
                    try{
                        this.receiveMessage(packet);
                    }catch(error){
                        if(error instanceof ReplySentWarning){
                            console.error(error);
                        }
                        //Do nothing.
                    }
                }
            });
        });
    }

    public async close(){
        return new Promise<ConnectionState>((resolve, reject) => {
            this._mqttServer.close(() => {
                this.emit(Events.BROKER_STOPPED, this);
                resolve(0);
            });
        });
    }

    /////////////////////////
    ///////Report
    /////////////////////////
    public getReport(){
        //Sub function to create Comms.
        const _createComms = (comms: Array<BrokerComm>) => {
            let _comms = new Array();
            comms.forEach(comm => {
                _comms.push({
                    fn: comm.handler.name,
                    [comm.method.toUpperCase()]: comm.topic
                });
            });
            return _comms;
        }

        //New publishers
        let publishers: {[name: string]: Array<string>} = {};

        //Get stack from _publisherComms
        this._publisherComms.forEach(stack => {
            publishers[stack.publisher.name] = _createComms(stack.comms);
        });

        return {
            serviceComms: _createComms(this._serviceComms),
            publishers: publishers
        }
    }

    /////////////////////////
    ///////Broadcast Functions
    /////////////////////////
    private sendBroadcast(){
        //Create Reply Object.
        const reply = this.createReply(this.broadcastTopic);

        //Define Broadcast
        const broadcast: Broadcast = {name: this.name, comms: this.comms};

        //Send Broadcast
        reply.send(broadcast);
    }

    /////////////////////////
    ///////Comm Functions 
    /////////////////////////
    private receiveMessage(packet: Packet){
        //Convert string to Json.
        const payload = JSON.parse(packet.payload.toString());

        //Validate if the payload is from the broker or client.
        //If the below step is not done, it will run into a infinite loop.
        if(payload.message !== undefined && payload.reply === undefined){
            //creating new parms.
            const message = this.createMessage(packet.topic, payload.message.parms);
            const reply = this.createReply(packet.topic);

            //Passing parms to comm handler Emitter
            this._commHandlers.emit(packet.topic, message, reply);

            //Global Emit.
            this.emit(Events.BROKER_RECEIVED_MESSAGE, message);
        }
    }

    public sendReply(reply: BrokerReply){
        //Covert Json to string.
        const packet = {
            topic: reply.topic,
            payload: JSON.stringify({reply: {body: reply.body, error: reply.error}}),
            qos: 0,
            retain: false
        };

        //Publish message on broker
        this._mqttServer.publish(packet, () => {
            //Global Emit.
            this.emit(Events.BROKER_SENT_REPLY, reply);
        });
    }

    /////////////////////////
    ///////Handle Functions
    /////////////////////////
    public reply(topic: Topic, replyHandler: ReplyHandler){
        //Add unique comm.
        this.addComm({method: 'reply', topic: topic, handler: replyHandler});
    }

    public transaction(topic: Topic, transactionHandler: TransactionHandler){
        //Add unique comm.
        this.addComm({method: 'transaction', topic: topic, handler: transactionHandler});
        //TODO: Possibly need to add additional topics to prepare/commit/rollback
    }

    /////////////////////////
    ///////create Functions
    /////////////////////////
    /**
     * Creates a new Message object.
     * 
     * @param topic
     * @param parms 
     * @returns the new message object created.
     */
    private createMessage(topic: Topic, parms: MessageParms){
        const message = new BrokerMessage(topic, parms);
        return message;
    }

    /**
     * Creates a new Reply object.
     * @param topic 
     * @returns the new reply object created.
     */
    private createReply(topic: Topic){
        const reply = new BrokerReply(topic);

        //Attaching events to send reply back.
        reply._event.once(Events.REPLY_SEND, (reply) => this.sendReply(reply));
        reply._event.once(Events.REPLY_ERROR, (reply) => this.sendReply(reply));

        return reply;
    }

    /////////////////////////
    ///////Helper Functions
    /////////////////////////
    /**
     * Adds a unique comm object into comms array based on topic uniqueness
     * and adds a listener. 
     * 
     * @param comm the new comm object.
     */
    private addComm(comm: BrokerComm){
        //Validate if comm exists.
        if(!this.comms.find(_comm => _comm.topic === comm.topic)){
            //Add comm to array
            this.comms.push(comm);
    
            //Add topic + handler to listener.
            this._commHandlers.on(comm.topic, comm.handler);
        }
    }
}

/////////////////////////
///////Comm
/////////////////////////
export interface BrokerComm extends Comm {
    handler: CommHandler
}

/////////////////////////
///////Message
/////////////////////////
export class BrokerMessage extends Message {
    constructor(topic: Topic, parms: MessageParms){
        super(topic, parms);
    }
}

/////////////////////////
///////Reply
/////////////////////////
export class BrokerReply extends Reply {
    private _sendCount: number;
    public readonly _event: EventEmitter;

    constructor(topic: Topic){
        super(topic);
        this._sendCount = 0;
        this._event = new EventEmitter();
    }

    send(body: ReplyBody): void {
        //Ensure the reply is sent only once.
        if(this._sendCount === 0){
            this._sendCount = 1;
            this._body = body;
            this._event.emit(Events.REPLY_SEND, this);
        }else{
            throw new ReplySentWarning();
        }
    }

    sendError(error: ReplyError): void {
        //Ensure the reply is sent only once.
        if(this._sendCount === 0){
            this._sendCount = 1;
            this._error = error;
            this._event.emit(Events.REPLY_ERROR, this);
        }else{
            throw new ReplySentWarning();
        }
    }
}

/////////////////////////
///////Error Classes
/////////////////////////
export class ReplySentWarning extends Error {
    constructor () {
        super('Reply already sent.');
        
        // Saving class name in the property of our custom error as a shortcut.
        this.name = this.constructor.name;
    
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
      }
}