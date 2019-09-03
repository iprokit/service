//Import modules
import mosca, { Packet } from 'mosca';
import { EventEmitter } from 'events';

//Types: ReplyCallback
export declare type ReplyCallback = (message: Message, reply: Reply) => void;

//Alternative for this.
var that: CommBroker;

export default class CommBroker {
    private mosca: mosca.Server;

    private topics: Array<string>;
    private replyCallbackEvent: EventEmitter;

    //Default Constructor
    constructor(){
        //Setting that as this.
        that = this;

        //Array of topics
        this.topics = new Array<string>();

        //Load reply callback emitter.
        this.replyCallbackEvent = new EventEmitter();

        //Broadcast topics.
        this.handleReply('/', (message: Message, reply: Reply) => {
            reply.send(that.topics);
        });
    }

    /////////////////////////
    ///////Start/Stop Functions
    /////////////////////////
    public listen(port: number | string){
        return new Promise((resolve, reject) => {
            const options = {
                id: global.service.name,
                port: port
            }
            
            this.mosca = new mosca.Server(options);
    
            this.mosca.on('ready', () => {
                resolve();
            });
    
            this.mosca.on('published', (packet, client) => {
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