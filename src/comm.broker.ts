//Import modules
import { EventEmitter } from 'events';
import { Server as MqttServer, Packet, Client } from 'mosca';

//Local Imports
import { Server, Events, Defaults, ConnectionState } from './microservice';

//Types: ReplyHandler
export declare type ReplyHandler = (message: Message, reply: Reply) => void;

//Export ReplyOptions
export type ReplyOptions = {
    topic: string,
    cb: ReplyHandler
}

export default class CommBroker extends EventEmitter implements Server {
    //Broker Variables.
    public readonly name: string;
    public readonly port: number;

    //MQTT Server
    private _mqttServer: MqttServer;

    //Topic Objects
    private readonly _broadcastTopic: string;
    private readonly _topics: Array<string>;

    //Comm Handler Events
    private readonly _commHandlers: EventEmitter;

    //Publishers
    private readonly _publisherTopics: Array<{publisher: typeof Publisher, topicStack: Array<ReplyOptions>}>;
    //TODO: Add type for reply, transcation event in _publisherTopics.
    //TODO: Implement transcations.
    //TODO: Implement Events.

    //Default Constructor
    constructor(){
        //Call super for EventEmitter.
        super();

        //Init Broker variables.
        this.name = global.service.name;
        this.port = Number(process.env.COM_BROKER_PORT) || Defaults.COMM_PORT;

        //Init variables.
        this._broadcastTopic = Defaults.BROADCAST_TOPIC;
        this._topics = new Array();
        this._publisherTopics = new Array();
        this._commHandlers = new EventEmitter();
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public addComm(topic: string, publisher: typeof Publisher, replyCallback: ReplyHandler){
        //Sub function to add Publisher to _publisherTopics
        const _addPublisherTopic = () => {
            //Create new topicStack.
            const topicStack = new Array({ topic: topic, cb: replyCallback });
    
            //Push Publisher & topicStack to publisherStack.
            this._publisherTopics.push({publisher: publisher, topicStack: topicStack});

            //Emit Publisher added event.
            this.emit(Events.BROKER_ADDED_PUBLISHER, publisher.name, publisher);
        }

        //Validate if _publisherTopics is empty.
        if(this._publisherTopics.length === 0){
            _addPublisherTopic();
        }else{
            //Find existing publisherTopic.
            const publisherTopic = this._publisherTopics.find(stack => stack.publisher.name === publisher.name);

            if(publisherTopic){ //publisherTopic exists. 
                publisherTopic.topicStack.push({topic: topic, cb: replyCallback});
            }else{  //No publisherTopic found.
                _addPublisherTopic();
            }
        }
    }

    /////////////////////////
    ///////Connection Management
    /////////////////////////
    public async listen(){
        return new Promise<ConnectionState>((resolve, reject) => {
            this._mqttServer = new MqttServer({ id: this.name, port: this.port });

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
        let publishers: {[name: string]: string[]} = {};

        this._publisherTopics.forEach(stack => {
            let cbName = new Array();
            stack.topicStack.forEach(topicStack => {
                cbName.push(topicStack.cb.name);
            })
            publishers[stack.publisher.name] = cbName;
        });   
        return publishers;
    }

    /////////////////////////
    ///////Broadcast Functions
    /////////////////////////
    private sendBroadcast(){
        const reply = new Reply(this._broadcastTopic);

        //Attaching events to send reply back.
        reply.once(Events.REPLY_SEND, (reply) => this.sendReply(reply));
        reply.once(Events.REPLY_ERROR, (reply) => this.sendReply(reply));

        //Send Reply
        reply.send({name: this.name, topics: this._topics});
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
        if(this._topics.indexOf(topic) === -1){
            //Add topic to array
            this._topics.push(topic);
    
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