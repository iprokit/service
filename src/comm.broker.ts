//Import modules
import mosca, { Packet, Client } from 'mosca';
import { EventEmitter } from 'events';
import { Request, Response } from 'express';
import httpStatus from 'http-status-codes';

//Local Imports
import FileUtility from './file.utility';
import { Report } from './routes';

//Types: ReplyCallback
export declare type ReplyCallback = (message: Message, reply: Reply) => void;

//Types: CommBrokerInitOptions
export type CommBrokerInitOptions = {
    autoInjectPublishers: AutoInjectPublisherOptions
};

//Types: AutoInjectPublisherOptions
export type AutoInjectPublisherOptions = {
    paths?: Array<string>,
    likeName?: string,
    excludes?: Array<string>
};

//Alternative for this.
var that: CommBroker;

export default class CommBroker {
    //Options
    private initOptions: CommBrokerInitOptions;

    private mosca: mosca.Server;

    private readonly broadcastTopic = '/';
    private topics: Array<string>;
    private replyCallbackEvent: EventEmitter;

    //Publishers
    public readonly publishers: Array<typeof Publisher> = new Array<typeof Publisher>();

    //Default Constructor
    constructor(){
        //Setting that as this.
        that = this;

        //Array of topics
        this.topics = new Array<string>();

        //Load reply callback emitter.
        this.replyCallbackEvent = new EventEmitter();

        //Auto call, to create broker endpoints.
        new CommBrokerController();
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

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public init(initOptions: CommBrokerInitOptions){
        //Load init options.
        this.initOptions = initOptions;
        this.initOptions.autoInjectPublishers = initOptions.autoInjectPublishers || {};

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

        //Adding files to Exclude.
        excludes.push('/node_modules');

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
            const options = {
                id: global.service.name,
                port: global.service.comBrokerPort
            }
            
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
        reply.send(this.topics);
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
            console.log('Broker: payload: %o', payload);

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
            console.log('Broker: payload: %o', packet.payload);
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

    constructor(topic: any){
        this._topic = topic;
    }
    
    public get topic() : string {
        return this._topic;
    }

    send(body: any): void {
        this.body = body;
        that.sendReply(this);
    }

    sendError(error: any): void {
        this.error = error;
        that.sendReply(this);
    }
}

/////////////////////////
///////Publisher
/////////////////////////
export class Publisher {
    constructor(){}   
}

/////////////////////////
///////CommBroker Controller
/////////////////////////
class CommBrokerController {
    @Report('/comm/broker/report')
    public getReport(request: Request, response: Response){
        try {
            let publishers = new Array<string>();
            that.publishers.forEach((publisher) => {
                publishers.push(publisher.constructor.name);
            });

            const data = {
                broadcastTopic: that.getBroadcastTopic(),
                topics: that.getTopics(),
                publishers: publishers,
            };

            response.status(httpStatus.OK).send({status: true, data});
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
        }
    }
}