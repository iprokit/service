//Import modules
import Promise from 'bluebird';
import { EventEmitter } from 'events';
import { Server as MqttServer, Packet, Client } from 'mosca';

//Local Imports
import { Server, Events, Defaults } from './microservice';
import Utility from './utility';

//Types: ReplyCallback
export declare type ReplyCallback = (message: Message, reply: Reply) => void;

//Export ReplyOptions
export type ReplyOptions = {
    name: string,
    topic: string,
    replyCB: ReplyCallback
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

    //Publishers
    private readonly _publishers: Array<typeof Publisher>;

    //Reply Events
    private readonly _replyCallbackEvent: EventEmitter;

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
        this._publishers = new Array();
        this._replyCallbackEvent = new EventEmitter();
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public initPublisher(publisher: any){
        const _publisher: typeof Publisher = new publisher();
        this._publishers.push(_publisher);
    }

    public addReply(publisher: Publisher, replyCallback: ReplyCallback){
        const publisherName = publisher.constructor.name.replace('Publisher', '');
        const topic = Utility.convertToTopic(publisherName, replyCallback.name);

        this.reply(topic, replyCallback);
    }

    /////////////////////////
    ///////Start/Stop Functions
    /////////////////////////
    public listen(){
        return new Promise<boolean>((resolve, reject) => {
            //Init server object
            const options = {
                id: this.name,
                port: this.port
            };
            this._mqttServer = new MqttServer(options, () => {
                this.emit(Events.BROKER_STARTED, this);
                resolve(true);
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

    public close(){
        return new Promise<boolean>((resolve, reject) => {
            this._mqttServer.close(() => {
                this.emit(Events.BROKER_STOPPED, this);
                resolve(true);
            });
        });
    }

    /////////////////////////
    ///////Report
    /////////////////////////
    public getReport(){
        let publishers = new Array();

        //DO get publisher data
        // this.publishers.forEach(publisher => {
        //     publishers.push({[publisher.constructor.name]: publisher.replies});
        // });

        return {
            publishers: publishers
        }
    }

    /////////////////////////
    ///////Broadcast Functions
    /////////////////////////
    private sendBroadcast(){
        const reply = new Reply(this._broadcastTopic, this);
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
            //Logging Message
            console.log('Broker: received a message on topic: %s', packet.topic);

            //creating new parms.
            const message = new Message(payload.message.parms);
            const reply = new Reply(packet.topic, this);

            //Passing parms to reply callback Emitter
            this._replyCallbackEvent.emit(packet.topic, message, reply);
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
            //Logging Reply
            console.log('Broker: published a reply on topic: %s', reply.topic);
        });
    }

    /////////////////////////
    ///////Handle Functions
    /////////////////////////
    public reply(topic: string, replyCallback: ReplyCallback){
        if(this._topics.indexOf(topic) === -1){
            //Add topic to array
            this._topics.push(topic);
    
            //Add reply callback listener.
            this._replyCallbackEvent.on(topic, replyCallback);
        }
    }
}

/////////////////////////
///////Message
/////////////////////////
interface IMessage {
    parms: any;
}

export class Message implements IMessage{
    public parms: any;

    constructor(parms: any){
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

export class Reply implements IReply{
    public readonly topic: any;
    private commBroker: CommBroker;

    public body: any;
    public error: any;
    private sendCount: number = 0;

    constructor(topic: any, commBroker: CommBroker){
        this.topic = topic;
        this.commBroker = commBroker;
    }

    send(body: any): void {
        //Ensure the reply is sent only once.
        if(this.sendCount === 0){
            this.sendCount = 1;
            this.body = body;
            this.commBroker.sendReply(this);
        }else{
            throw new ReplySentWarning();
        }
    }

    sendError(error: any): void {
        //Ensure the reply is sent only once.
        if(this.sendCount === 0){
            this.sendCount = 1;
            this.error = error;
            this.commBroker.sendReply(this);
        }else{
            throw new ReplySentWarning();
        }
    }
}

/////////////////////////
///////Publisher
/////////////////////////
export class Publisher {
    constructor(){}
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