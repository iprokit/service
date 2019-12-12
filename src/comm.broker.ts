//Import modules
import { Server, Packet, Client } from 'mosca';
import { EventEmitter } from 'events';

//Local Imports
import { Component, Defaults, Events } from './microservice';

//Types: ReplyCallback
export declare type ReplyCallback = (message: Message, reply: Reply) => void;

//Export ReplyOptions
export type ReplyOptions = {
    name: string,
    topic: string,
    replyCB: ReplyCallback
}

export default class CommBroker extends EventEmitter implements Component {
    //Broker Variables.
    private port: number;
    private serviceName: string;

    //Mosca Server
    private mosca: Server;

    //Topic Objects
    private readonly broadcastTopic: string;
    private readonly topics: Array<string>;

    //Publishers
    private readonly publishers: Array<typeof Publisher>;

    //Reply Events
    private readonly replyCallbackEvent: EventEmitter;

    //Default Constructor
    constructor(){
        //Call super for EventEmitter.
        super();

        //Init Broker variables.
        this.port = Number(process.env.COM_BROKER_PORT) || Defaults.COMM_PORT;

        //Init variables.
        this.broadcastTopic = Defaults.BROADCAST_TOPIC;
        this.topics = new Array();
        this.publishers = new Array();
        this.replyCallbackEvent = new EventEmitter();
    }

    /////////////////////////
    ///////Gets/Sets
    /////////////////////////
    public getReport(){
        let publishers = new Array();

        this.publishers.forEach(publisher => {
            publishers.push({[publisher.constructor.name]: publisher.replies});
        });

        return {
            init: {
                broadcastTopic: this.broadcastTopic,
                port: this.port
            },
            publishers: publishers
        }
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public init(serviceName: string){
        //Init connection variables
        this.serviceName = serviceName;
    }

    public initPublisher(publisher: any){
        const _publisher: typeof Publisher = new publisher();
        this.emit(Events.INIT_PUBLISHER, _publisher.constructor.name, _publisher);

        _publisher.replies.forEach(reply => {
            this.reply(reply.topic, reply.replyCB);
        });
        this.publishers.push(_publisher);
    }

    /////////////////////////
    ///////Start/Stop Functions
    /////////////////////////
    public listen(){
        //Init server object
        const options = {
            id: this.serviceName,
            port: this.port
        };
        this.mosca = new Server(options);

        this.mosca.on('ready', () => {
            this.emit(Events.BROKER_STARTED, {port: this.port});
        });

        this.mosca.on('subscribed', (topic: any, client: Client) => {
            //Broadcast
            if(topic === this.broadcastTopic){
                this.sendBroadcast();
            }
        });

        this.mosca.on('published', (packet: Packet, client: Client) => {
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
    }

    public close(callback?: Function){
        this.mosca.close(() => {
            this.emit(Events.BROKER_STOPPED);
            if(callback){
                callback();
            }
        });
    }

    /////////////////////////
    ///////Broadcast Functions
    /////////////////////////
    private sendBroadcast(){
        const reply = new Reply(this.broadcastTopic, this);
        reply.send({name: this.serviceName, topics: this.topics});
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
            this.replyCallbackEvent.emit(packet.topic, message, reply);
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
        this.mosca.publish(packet, () => {
            //Logging Reply
            console.log('Broker: published a reply on topic: %s', reply.topic);
        });
    }

    /////////////////////////
    ///////Handle Functions
    /////////////////////////
    public reply(topic: string, replyCallback: ReplyCallback){
        if(this.topics.indexOf(topic) === -1){
            //Add topic to array
            this.topics.push(topic);
    
            //Add reply callback listener.
            this.replyCallbackEvent.on(topic, replyCallback);
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
    public static replies: Array<ReplyOptions>;

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