//Import modules
import mqtt from 'mqtt'

//Local Imports
import CommUtility from './comm.utility';

//Interface: IMessage
interface IMessage {
    readonly topic: string;
    readonly parms: any;
}

//Interface: IReply
interface IReply {
    readonly topic: string;
    readonly body: any;
    readonly error: any;
}

var that: CommSubscriber;

export function service(serviceName: string){
    return new CommSubscriber(serviceName);
}

class CommSubscriber {
    private client: mqtt.MqttClient;

    //Default Constructor
    constructor(serviceName: string){
        that = this;
        //Convert serviceName to url

        const ip = '10.0.0.179';
        const port = global.service.comPort;
        const url = 'mqtt://' + ip + ':' + port;
        this.connect(url);
    }

    /////////////////////////
    ///////Connection Management
    /////////////////////////
    private connect(url: string){
        const options = {
            clientId: global.service.name,
            keepalive: 30
        }

        this.client = mqtt.connect(url, options);
        this.client.on('connect', () => {
            this.executeSubscribeFunction('/', {})
                .then((reply: Reply) => {
                    this.generateSubscribes(reply.body);
                })
        });
    }

    /////////////////////////
    ///////Other Functions
    /////////////////////////
    private generateSubscribes(topics: Array<string>){
        //Convert topics into subscribers with dynamic functions.
        topics.forEach(topic => {
            const converter = CommUtility.convertToFunction(topic);

            let subscriber;
            //Validate and grenrate a subscriber object or get it from this class object.
            if(this.constructor.prototype[converter.className] === undefined){
                subscriber = new Subscriber(converter.className);
            }else{
                subscriber = this.constructor.prototype[converter.className];
            }

            //Generate dynamic funcations and add it to subscriber object.
            const subscribe = function(body?: any) {
                return that.executeSubscribeFunction(topic, body);
            }
            Object.defineProperty(subscriber, converter.functionName, {value: subscribe});

            //Adding the subscriber object to this class object.
            this.constructor.prototype[converter.className] = subscriber;
        });
    }

    private executeSubscribeFunction(topic: string, parms?: any) {
        return new Promise((resolve, reject) => {
            //TODO: Move client creating here.
            that.client.subscribe(topic, (error: any) => {
                if (!error) {
                    this.handleMessage(topic, parms);

                    //Receive from Topic.
                    that.client.on('packetreceive', (packet: any) => {
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
                    })
                } else {
                    reject(error);
                }
            });
        });
    }

    /////////////////////////
    ///////Handle Functions
    /////////////////////////
    private handleMessage(topic: string, parms: any){
        //creating message parms.
        const message = new Message(topic, parms);

        //Covert Json to string.
        const payload = JSON.stringify({ message: message });

        //Publish message on broker
        this.client.publish(topic, payload, () => {
            //Logging Message
            console.log('Client: published a message on topic: %s', topic);
        });
    }

    private handleReply(packet: any){
        //Convert string to Json.
        const payload = JSON.parse(packet.payload.toString());

        //Validate if the payload is from the publisher(broker) or subscriber(client).
        if(!payload.reply !== undefined && payload.message === undefined){
            //creating reply parms.
            const reply = new Reply(packet.topic, payload.reply, payload.error);

            //Logging Message
            console.log('Client: published a reply on topic: %s', packet.topic);

            //creating reply parms.
            return reply;
        }
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