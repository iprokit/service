//Import modules
import mqtt from 'mqtt'

//Local Imports
import CommUtility from './comm.utility';

//Type: Parms
declare type Parms = {};

//Type: Body
declare type Body = {};

//Interface: IMessage
interface IMessage {
    readonly topic: string;
    readonly parms: any;
}

//Interface: IReply
interface IReply {
    readonly topic: string;
    readonly body: string;
    readonly error: string;
}

//Types: SubscribeCallback
export declare type SubscribeCallback = (parms?: Parms) => Promise<Body>;

/////////////////////////
///////Setup: service
/////////////////////////
export function service(serviceName: string){
    //TODO: Convert serviceName to url
    const ip = '127.0.0.1';
    const port = global.service.comPort;
    const url = 'mqtt://' + ip + ':' + port;

    //Creating subscriber object.
    const subscriber = new CommSubscriber();
    subscriber.connect(url);

    //return subscriber object.
    return subscriber;
}

class CommSubscriber {
    private client: mqtt.MqttClient;

    //Default Constructor
    constructor(){}

    /////////////////////////
    ///////Start/Stop Functions
    /////////////////////////
    public connect(url: string){
        const options = {
            clientId: global.service.name,
            keepalive: 30
        }

        this.client = mqtt.connect(url, options);

        this.client.on('connect', () => {
            //Logging Message
            console.log('Client: Connected to comm broker running on %s', url);

            //Get all topics from comm broker.
            this.handleMessageReply('/', {})
                .then((topics: []) => {
                    this.generateSubscribers(topics);
                })
                .catch((error) => {
                    console.log(error);
                });
        });
    }

    /////////////////////////
    ///////Handle Functions
    /////////////////////////
    private handleMessageReply(topic: string, parms?: Parms){
        return new Promise<Body>((resolve, reject) => {
            //Handle message.
            this.handleMessage(topic, parms);

            //On message.
            this.client.on('message', (topic, payload, packet) => {
                //TODO: Bug(Circular) here this is being called multiple times. Work from here.
                try{
                    const reply = this.handleReply(packet);
                    if(reply.body){
                        resolve(reply.body);
                    }else if(reply.error){
                        reject(reply.error);
                    }
                } catch (error) {
                    //console.log('Client: Does not contain payload, Waiting...');
                }
            });
        });
    }

    private handleMessage(topic: string, parms: Parms){
        //creating message parms.
        const message = new Message(topic, parms);

        //Convert Json to string.
        const payload = JSON.stringify({ message: message });

        //Subscribe & Publish
        this.client.subscribe(message.topic);
        this.client.publish(message.topic, payload);

        //Logging Message
        console.log('Client: published a message on topic: %s', topic);
    }

    private handleReply(packet: any){
        //Convert string to Json.
        const payload = JSON.parse(packet.payload.toString());

        //Validate if the payload is from the publisher(broker) or subscriber(client).
        if(!payload.reply !== undefined && payload.message === undefined){
            //creating reply parms.
            const reply = new Reply(packet.topic, payload.reply.body, payload.reply.error);

            //Unsubscribe
            this.client.unsubscribe(packet.topic);

            //Logging Reply
            console.log('Client: received a reply on topic: %s', packet.topic);

            //Return reply object.
            return reply;
        }
    }

    /////////////////////////
    ///////Generators Functions
    /////////////////////////
    private generateSubscribers(topics: Array<string>){
        //Convert topics into subscribers with dynamic functions.
        topics.forEach(topic => {
            const converter = CommUtility.convertToFunction(topic);

            if(converter){
                let subscriber;

                //Alternative for this to pass as accessor.
                var that = this;

                //Validate and generate a subscriber object or get it from this class object.
                if(this.constructor.prototype[converter.className] === undefined){
                    subscriber = new Subscriber(converter.className);
                }else{
                    subscriber = this.constructor.prototype[converter.className];
                }

                //Generate dynamic funcations and add it to subscriber object.
                //TODO: Bug(Circular)
                const subscribe = function(body?: any) {
                    return that.handleMessageReply(topic, body);
                }
                Object.defineProperty(subscriber, converter.functionName, {value: subscribe});

                //Adding the subscriber object to this class object.
                this.constructor.prototype[converter.className] = subscriber;
            }
        });
    }
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
    readonly topic: string;
    readonly parms: any;

    constructor(topic: string, parms: any){
        this.topic = topic;
        this.parms = parms;
    }
}

/////////////////////////
///////Reply
/////////////////////////
class Reply implements IReply{
    readonly topic: string;
    readonly body: any;
    readonly error: any;

    constructor(topic: string, body: any, error: any){
        this.topic = topic;
        this.body = body;
        this.error = error;
    }
}