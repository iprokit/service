//Import modules
import { EventEmitter } from 'events';
import { Server as MqttServer, Packet, Client } from 'mosca';

//Local Imports
import { Server, Events, Defaults, ConnectionState } from './microservice';

//Types: CommHandlers
export declare type CommHandlers = ReplyHandler | TransactionHandler;
export declare type ReplyHandler = (message: Message, reply: Reply) => void;
export declare type TransactionHandler = (message: Message, transactionReply: TransactionReply) => void;

//Export Comm
export type CommMethod = 'reply' | 'transaction';
export type Comm = {
    method: CommMethod,
    topic: string,
    handler: CommHandlers
}

export default class CommBroker extends EventEmitter implements Server {
    //Broker Variables.
    public readonly name: string;
    public readonly port: number;

    //MQTT Server
    private _mqttServer: MqttServer;

    //Topic
    private readonly _broadcastTopic: string;
    public readonly comms: Array<Comm>;

    //Comm Handler Events
    private readonly _commHandlers: EventEmitter;

    //Publishers
    private readonly _publisherComms: Array<{publisher: typeof Publisher, comms: Array<Comm>}>;
    private readonly _serviceComms: Array<Comm>;

    //Default Constructor
    constructor(){
        //Call super for EventEmitter.
        super();

        //Init Broker variables.
        this.name = global.service.name;
        this.port = Number(process.env.COM_BROKER_PORT) || Defaults.COMM_PORT;

        //Init Topic.
        this._broadcastTopic = Defaults.BROADCAST_TOPIC;
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
    public addPublisherComm(method: CommMethod, topic: string, publisher: typeof Publisher, handler: CommHandlers){
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
                if(topic === this._broadcastTopic){
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
        const _createComms = (comms: Array<Comm>) => {
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
        const reply = new Reply(this._broadcastTopic);

        //Attaching events to send reply back.
        reply.once(Events.REPLY_SEND, (reply) => this.sendReply(reply));
        reply.once(Events.REPLY_ERROR, (reply) => this.sendReply(reply));

        //TODO: Remove this later.
        let topics = new Array();
        this.comms.forEach(comm => topics.push(comm.topic));

        //Send Reply
        reply.send({name: this.name, topics: topics});
    }

    /////////////////////////
    ///////Comm Functions 
    /////////////////////////
    private receiveMessage(packet: Packet){
        //Convert string to Json.
        const payload = JSON.parse(packet.payload.toString());

        //Validate if the payload is from the broker or client.
        if(payload.message !== undefined && payload.reply === undefined){
            //creating new parms.
            const message = new Message(packet.topic, payload.message.parms);
            const reply = new Reply(packet.topic);

            //Attaching events to send reply back.
            reply.once(Events.REPLY_SEND, (reply) => this.sendReply(reply));
            reply.once(Events.REPLY_ERROR, (reply) => this.sendReply(reply));

            //Passing parms to comm handler Emitter
            this._commHandlers.emit(packet.topic, message, reply);

            //Global Emit.
            this.emit(Events.BROKER_RECEIVED_MESSAGE, message);
        }
    }

    public sendReply(reply: Reply){
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
    public reply(topic: string, replyHandler: ReplyHandler){
        //Define comm.
        const comm: Comm = {method: 'reply', topic: topic, handler: replyHandler};
        
        //Validate if comm exists.
        if(!this.comms.find(comm => comm.topic === topic)){
            //Add comm to array
            this.comms.push(comm);
    
            //Add reply handler listener.
            this._commHandlers.on(topic, replyHandler);
        }
    }
}

/////////////////////////
///////Message
/////////////////////////
interface IMessage {
    topic: string;
    parms: any;
}

export class Message implements IMessage{
    public readonly topic: string;
    public readonly parms: any;

    constructor(topic: string, parms: any){
        this.topic = topic;
        this.parms = parms;
    }
}

/////////////////////////
///////Reply
/////////////////////////
interface IReply {
    body: any;
    error: any;
    send(body: any): void;
    sendError(error: any): void;
}

export class Reply extends EventEmitter implements IReply{
    public readonly topic: string;

    private _body: any;
    private _error: any;
    private _sendCount: number = 0;

    constructor(topic: string){
        //Call super for EventEmitter.
        super();

        this.topic = topic;
    }

    send(body: any): void {
        //Ensure the reply is sent only once.
        if(this._sendCount === 0){
            this._sendCount = 1;
            this._body = body;
            this.emit(Events.REPLY_SEND, this);
        }else{
            throw new ReplySentWarning();
        }
    }

    sendError(error: any): void {
        //Ensure the reply is sent only once.
        if(this._sendCount === 0){
            this._sendCount = 1;
            this._error = error;
            this.emit(Events.REPLY_ERROR, this);
        }else{
            throw new ReplySentWarning();
        }
    }

    get body(){
        return this._body;
    }

    get error(){
        return this._error;
    }
}

export class TransactionReply extends EventEmitter{
    constructor(){
        //Call super for EventEmitter.
        super();
    }
}

/////////////////////////
///////Publisher
/////////////////////////
export class Publisher{
    //Default Constructor
    constructor(){}

    //Get Name
    get name(){
        return this.constructor.name;
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