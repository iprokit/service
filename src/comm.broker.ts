//Import modules
import mosca, { Packet, Client } from 'mosca';
import { EventEmitter } from 'events';

//Local Imports
import { Component } from './microservice';
import FileUtility from './file.utility';

//Types: ReplyCallback
export declare type ReplyCallback = (message: Message, reply: Reply) => void;

//Types: CommBrokerInitOptions
export type CommBrokerInitOptions = {
    autoInjectPublishers: AutoInjectPublisherOptions
};

//Types: ConnectionOptions
export type ConnectionOptions = {
    name: string,
    port: number
};

//Types: AutoInjectPublisherOptions
export type AutoInjectPublisherOptions = {
    paths?: Array<string>,
    likeName?: string,
    excludes?: Array<string>
};

//Alternative for this.
var that: CommBroker;

export default class CommBroker implements Component {
    //Options
    private initOptions: CommBrokerInitOptions;
    private connectionOptions: ConnectionOptions;

    //Mosca Server
    private mosca: mosca.Server;

    //Topic Objects
    private readonly broadcastTopic = '/';
    private readonly topics: Array<string> = new Array<string>();
    private replyCallbackEvent: EventEmitter;

    //Publishers
    private readonly publishers: Array<typeof Publisher> = new Array<typeof Publisher>();

    //Default Constructor
    constructor(){
        //Setting that as this.
        that = this;

        //Load connection options.
        this.connectionOptions = {
            name: global.service.name,
            port: global.service.comBrokerPort
        }

        //Load reply callback emitter.
        this.replyCallbackEvent = new EventEmitter();
    }

    /////////////////////////
    ///////Gets/Sets
    /////////////////////////
    public getBroadcastTopic() {
        return this.broadcastTopic;
    }

    public getTopics() {
        return this.topics;
    }

    public getPublishers() {
        return this.publishers;
    }

    public getOptions() {
        return {connectionOptions: this.connectionOptions, initOptions: this.initOptions};
    }

    public getReport(){
        let publishers = new Array();

        this.publishers.forEach((publisher) => {
            publishers.push(publisher.constructor.name);
        });

        const report = {
            init: {
                broadcastTopic: this.broadcastTopic,
            },
            publishers: publishers,
            topics: this.topics,
        };
        return report;
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public init(initOptions: CommBrokerInitOptions){
        //Load init options.
        this.initOptions = initOptions;
        this.initOptions.autoInjectPublishers = initOptions.autoInjectPublishers || {}

        //Load Publishers
        this.autoInjectPublishers(this.initOptions.autoInjectPublishers);
    }

    /////////////////////////
    ///////Inject Functions
    /////////////////////////
    private autoInjectPublishers(autoInjectOptions: AutoInjectPublisherOptions){
        let paths = autoInjectOptions.paths || ['/'];
        const likeName = autoInjectOptions.likeName || 'publisher.js';
        const excludes = autoInjectOptions.excludes || [];

        paths.forEach((path: string) => {
            let publisherPaths = FileUtility.getFilePaths(path, likeName, excludes);
            publisherPaths.forEach(publisherPath => {
                const Publisher = require(publisherPath).default;
                const publisher = new Publisher();

                console.log('Mapping publishers: %s', publisher.constructor.name);

                //Add to Array
                this.publishers.push(publisher);
            });
        });
    }

    /////////////////////////
    ///////Start/Stop Functions
    /////////////////////////
    public listen(){
        return new Promise((resolve, reject) => {
            //Set options
            const options = {
                id: this.connectionOptions.name,
                port: this.connectionOptions.port
            }

            //Init Server object
            this.mosca = new mosca.Server(options);
    
            this.mosca.on('ready', () => {
                resolve();
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
        });
    }

    public close(){
        return new Promise((resolve, reject) => {
            this.mosca.close(() => {
                resolve();
            });
        });
    }

    /////////////////////////
    ///////Broadcast Functions
    /////////////////////////
    private sendBroadcast(){
        const reply = new Reply(this.broadcastTopic);
        reply.send({name: this.connectionOptions.name, topics: this.topics});
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
            const reply = new Reply(packet.topic);

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
    public handleReply(topic: string, replyCallback: ReplyCallback){
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
    private _topic: any;
    public body: any;
    public error: any;
    private sendCount: number = 0;

    constructor(topic: any){
        this._topic = topic;
    }
    
    public get topic() : string {
        return this._topic;
    }

    send(body: any): void {
        //Ensure the reply is sent only once.
        if(this.sendCount === 0){
            this.sendCount = 1;
            this.body = body;
            that.sendReply(this);
        }else{
            throw new ReplySentWarning();
        }
    }

    sendError(error: any): void {
        //Ensure the reply is sent only once.
        if(this.sendCount === 0){
            this.sendCount = 1;
            this.error = error;
            that.sendReply(this);
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
class ReplySentWarning extends Error{
    constructor () {
        super('Reply already sent.');
        
        // Saving class name in the property of our custom error as a shortcut.
        this.name = this.constructor.name;
    
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
      }
}