//Import modules
import { Server, Packet, Client } from 'mosca';
import { EventEmitter } from 'events';

//Local Imports
import { Component, Defaults, Events, AutoLoadOptions } from './microservice';
import Utility from './utility';

//Types: ReplyCallback
export declare type ReplyCallback = (message: Message, reply: Reply) => void;

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
    public getTopics() {
        return this.topics;
    }

    public getPublishers() {
        return this.publishers;
    }

    public getReport(){
        try{
            let publishers = new Array();

            this.publishers.forEach((publisher) => {
                publishers.push(publisher.constructor.name);
            });

            const report = {
                init: {
                    broadcastTopic: this.broadcastTopic,
                    port: this.port
                },
                publishers: publishers,
                topics: this.topics,
            };
            return report;
        }catch(error){
            return {}
        }
    }

    /////////////////////////
    ///////Inject Functions
    /////////////////////////
    public autoInjectPublishers(autoInjectOptions: AutoLoadOptions){
        let paths = autoInjectOptions.paths || ['/'];
        const likeName = autoInjectOptions.likeName || 'publisher.js';
        const excludes = autoInjectOptions.excludes || [];

        paths.forEach((path: string) => {
            let publisherPaths = Utility.getFilePaths(path, likeName, excludes);
            publisherPaths.forEach(publisherPath => {
                const _Publisher = require(publisherPath).default;

                if(_Publisher.prototype instanceof Publisher){
                    const publisher: typeof Publisher = new _Publisher();
    
                    console.log('Mapping publisher: %s', publisher.constructor.name);
    
                    //Add to Array
                    this.publishers.push(publisher);
                }else{
                    console.log('Could not map publisher: %s', _Publisher.constructor.name);
                }
            });
        });
    }

    /////////////////////////
    ///////Start/Stop Functions
    /////////////////////////
    public listen(serviceName: string){
        //Init connection variables
        this.serviceName = serviceName;

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
    constructor(){}
}

/////////////////////////
///////Transaction Classes
/////////////////////////
export class Transaction {
    //TODO: Start work from here for transaction.
    public start(){

    }
    public commit(){

    }
    public rollback(){
        
    }
}

/////////////////////////
///////Error Classes
/////////////////////////
class ReplySentWarning extends Error{
    constructor () {
        super('Reply already sent.');
        
        // Saving class name in the property of our custom error as a shortcut.
        this.name = this.constructor.name;
    
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
      }
}