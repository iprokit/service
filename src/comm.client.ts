//Import modules
import mqtt, { Packet } from 'mqtt'
import { EventEmitter } from 'events';

//Local Imports
import CommUtility from './comm.utility';

//Type: Parms
declare type Parms = {};

//Type: Body
declare type Body = {};

//Interface: IMessage
interface IMessage {
    parms: any;
}

//Interface: IReply
interface IReply {
    body: string;
    error: string;
}

//Types: MessageCallback
export declare type MessageCallback = (parms?: Parms) => Promise<unknown>;

//Alternative for this.
var that: CommClient;

export default class CommClient {
    public readonly url: string;

    private topics: Array<string>;
    private mqttClient: mqtt.MqttClient;
    private messageCallbackEvent: EventEmitter;

    //Default Constructor
    constructor(ip: string){
        //Setting that as this.
        that = this

        //Creating url from ip and comPort
        this.url = 'mqtt://' + ip + ':' + global.service.comPort;

        //Array of topics
        this.topics = new Array<string>();

        //Load message callback emitter.
        this.messageCallbackEvent = new EventEmitter();
    }

    /////////////////////////
    ///////Start/Stop Functions
    /////////////////////////
    public connect(){
        return new Promise((resolve, reject) => {
            const options = {
                id: global.service.name,
                keepalive: 30
            };
    
            this.mqttClient = mqtt.connect(this.url, options);
    
            this.mqttClient.on('connect', () => {
                resolve({url: this.url});
                this.getAllTopics();
            });
            
            this.mqttClient.on('message', (topic, payload, packet) => {
                this.receiveReply(packet);
            });
        });
    }

    public disconnect(){
        return new Promise((resolve, reject) => {
            this.mqttClient.end(true, () => {
                resolve({url: this.url});
            });
        });
    }

    /////////////////////////
    ///////Setup Functions
    /////////////////////////
    private getAllTopics(){
        //Subscribe to report topic.
        this.mqttClient.subscribe('/');

        this.handleMessage('/', {})
            .then((topics: []) => {
                //Subscribe to topic.
                this.mqttClient.subscribe(topics);
                console.log(topics);
            });
    }

    /////////////////////////
    ///////Comm Functions 
    /////////////////////////
    private sendMessage(topic: string, message: Message){
        //Convert string to Json.
        const payload = JSON.stringify({message: message});

        //Publish message on broker
        this.mqttClient.publish(topic, payload, { qos: 0 }, () => {
            //Logging Message
            console.log('Client: published a message on topic: %s', topic);
            console.log('Client: payload: %o', payload);
        });
    }

    private receiveReply(packet: any){
        //Convert string to Json.
        const payload = JSON.parse(packet.payload.toString());

        //Validate if the payload is from the broker or client.
        if(payload.reply !== undefined && payload.message === undefined){
            //Logging Message
            console.log('Client: received a reply on topic: %s', packet.topic);
            console.log('Client: payload: %o', payload);

            //creating new reply parm.
            const reply = new Reply(payload.reply.body, payload.reply.error);

            this.messageCallbackEvent.emit(packet.topic, reply);
        }
    }

    /////////////////////////
    ///////Handle Functions
    /////////////////////////
    public handleMessage(topic: string, parms: Parms){
        return new Promise((resolve, reject) => {
            //Listen for reply on broker
            this.messageCallbackEvent.once(topic, (reply: Reply) => {
                if(reply.body !== undefined){
                    resolve(reply.body);
                }else{
                    reject(reply.error);
                }
            });

            //Creating new message parm.
            const message = new Message(parms);

            //Sending message
            this.sendMessage(topic, message);
        });
    }

    // /////////////////////////
    // ///////Generators Functions
    // /////////////////////////
    // private generateSubscribers(topics: Array<string>){
    //     //Convert topics into subscribers with dynamic functions.
    //     topics.forEach(topic => {
    //         const converter = CommUtility.convertToFunction(topic);

    //         if(converter){
    //             let subscriber;

    //             //Alternative for this to pass as accessor.
    //             var that = this;

    //             //Validate and generate a subscriber object or get it from this class object.
    //             if(this.constructor.prototype[converter.className] === undefined){
    //                 subscriber = new Subscriber(converter.className);
    //             }else{
    //                 subscriber = this.constructor.prototype[converter.className];
    //             }

    //             //Generate dynamic funcations and add it to subscriber object.
    //             //TODO: Bug(Circular)
    //             const subscribe = function(body?: any) {
    //                 return that.handleMessageReply(topic, body);
    //             }
    //             Object.defineProperty(subscriber, converter.functionName, {value: subscribe});

    //             //Adding the subscriber object to this class object.
    //             this.constructor.prototype[converter.className] = subscriber;
    //         }
    //     });
    // }
}

/////////////////////////
///////Subscriber
/////////////////////////
class Subscriber {
    name: string;

    constructor(name: string){
        this.name = name;
    }
}

/////////////////////////
///////Message
/////////////////////////
class Message implements IMessage{
    readonly parms: any;

    constructor(parms: any){
        this.parms = parms;
    }
}

/////////////////////////
///////Reply
/////////////////////////
class Reply implements IReply{
    readonly body: any;
    readonly error: any;

    constructor(body: any, error: any){
        this.body = body;
        this.error = error;
    }
}