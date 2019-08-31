//Import modules
import mqtt from 'mqtt'

//Local Imports
import CommUtility from './comm.utility';

var that: CommSubscriber;

export function service(serviceName: string){
    return new CommSubscriber(serviceName);
    //TODO: Continue from here.
}

class CommSubscriber {
    private client: mqtt.MqttClient;

    //Default Constructor
    constructor(serviceName: string){
        that = this;
        //Convert serviceName to url

        this.init();
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    private init(){
        return new Promise((resolve, reject) => {
            const url = 'mqtt://10.0.0.179:1883'
            const options = {
                clientId: global.service.name,
                keepalive: 30
            }

            this.client = mqtt.connect(url, options);
            this.client.on('connect', () => {
                console.log('Client: Connected to MQTT broker');

                ///Assume we got array of topics from topic: /
                this.executeSubscribeFunction('/', {})
                    .then((topics: any) => {
                        console.log(topics);
                        this.generateSubscribes(topics);
                        resolve();
                    })
            });
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

    private executeSubscribeFunction(topic: string, body?: any) {
        //TODO: convert to custom function.
        return new Promise((resolve, reject) => {
            that.client.subscribe(topic, (error: any) => {
                if (!error) {
                    console.log('Client: Subscribed to topic: %s', topic);

                    body = body || {}
                    //console.log(body);
                    const payload = JSON.stringify({message: {body: body}});
                    //console.log(payload);
                    //Publish to Topic.
                    that.client.publish(topic, payload, (error: any) => {
                        if (!error) {
                            console.log('Client: message: %o published on topic: %s', payload, topic);
                        } else {
                            reject(error);
                        }
                    });

                    //Receive from Topic.
                    that.client.on('packetreceive', (packet: any) => {
                        let payload = packet.payload;

                        try {
                            payload = JSON.parse(payload.toString());
                            if (payload.response != null) {
                                console.log('Client: message: %o received on topic: %s', payload, packet.topic);
                                resolve(payload.response);
                            } else {
                                console.log('Client: payload data is null');
                                //When reconnect this condition is called after subscribe
                                //Ignoring the message returing back
                            }
                        } catch (error) {
                            if (error instanceof TypeError) {
                                console.log('Client: Does not contain payload, Waiting...');
                            } else {
                                console.log('Client: Some other issue', error);
                                //Might need to reject and send callback
                            }
                        }
                    })
                } else {
                    reject(error);
                }
            });
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