//Import modules
import mqtt from 'mqtt'
import { EventEmitter } from 'events';

//Local Imports
import CommUtility from './comm.utility';

//Alternative for this.
var that: CommClient;

export default class CommClient {
    private mqttClient: mqtt.MqttClient;
    public readonly host: string;
    private readonly url: string;
    private connected: boolean = false;
    
    public readonly broadcastTopic = '/';
    private topics: Array<string>;
    private messageCallbackEvent: EventEmitter;

    //Default Constructor
    constructor(host: string){
        //Setting that as this.
        that = this;

        //Setting host
        this.host = host;

        //Array of topics
        this.topics = new Array<string>();

        //Creating url
        this.url = 'mqtt://' + this.host;

        //Load message callback emitter.
        this.messageCallbackEvent = new EventEmitter();
    }

    /////////////////////////
    ///////Gets/Sets
    /////////////////////////
    public isConnected() {
        return this.connected;
    }

    public getTopics() {
        return this.topics;
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
                //Subscribe to all topics.
                this.mqttClient.subscribe(this.broadcastTopic);

                //Set connected boolean
                this.connected = true;

                //Return.
                resolve({url: this.url});
            });

            //TODO: Add disconnect event.
            
            this.mqttClient.on('message', (topic, payload, packet) => {
                //Receive broadcast
                if(topic === this.broadcastTopic){
                    this.receiveBroadcast(packet);
                }else{
                    this.receiveReply(packet);
                }
            });
        });
    }

    public disconnect(){
        return new Promise((resolve, reject) => {
            this.mqttClient.end(true, () => {
                resolve(this.url);
            });
        });
    }

    /////////////////////////
    ///////Broadcast Functions
    /////////////////////////
    private receiveBroadcast(packet: any){
        //Add listener then receive reply
        this.messageCallbackEvent.once(this.broadcastTopic, (reply: Reply) => {
            if(reply.body !== undefined){
                this.topics = reply.body;
                this.mqttClient.subscribe(reply.body);
                this.generateSubscribers(reply.body);
            }
        });

        this.receiveReply(packet);
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
    public handleMessage(topic: string, parms: any){
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

    /////////////////////////
    ///////Generate Functions
    /////////////////////////
    private generateSubscribers(topics: Array<string>){
        //Convert topics into subscribers with dynamic functions.
        topics.forEach(topic => {
            const converter = CommUtility.convertToFunction(topic);

            if(converter){
                let subscriber;

                //Validate and generate a subscriber object or get it from this class object.
                if(this.constructor.prototype[converter.className] === undefined){
                    subscriber = new Subscriber(converter.className, topic);
                }else{
                    subscriber = this.constructor.prototype[converter.className];
                }

                //Generate dynamic funcations and add it to subscriber object.
                const subscribe = function(parms?: any) {
                    return that.handleMessage(this.topic, parms);
                }
                Object.defineProperty(subscriber, converter.functionName, {value: subscribe});

                //Adding the subscriber object to this class object.
                this.constructor.prototype[converter.className] = subscriber;
            }
        });
    }
}

/////////////////////////
///////Message
/////////////////////////
interface IMessage {
    parms: any;
}

export class Message implements IMessage{
    readonly parms: any;

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
}

export class Reply implements IReply{
    readonly body: any;
    readonly error: any;

    constructor(body: any, error: any){
        this.body = body;
        this.error = error;
    }
}

/////////////////////////
///////Subscriber
/////////////////////////
export class Subscriber {
    name: string;
    topic: string;

    constructor(name: string, topic: string){
        this.name = name;
        this.topic = topic;
    }
}