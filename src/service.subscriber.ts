//Import modules
import mqtt, { Packet } from 'mqtt'

//Local Imports
import ServiceUtility from './service.utility';


///Should be treated like a model and created from app.ts

var that: ServiceSubscriber;
export default class ServiceSubscriber {
    private client: mqtt.MqttClient;

    constructor(serviceName: string){
        that = this;
        //Convert serviceName to url
    }

    public init(){
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
                const topics = ['/Customer/getCustomer', '/EndUser/get', '/EndUser/put' , '/Customer/getCustomers'];
                this.generateSubscribes(topics);
                resolve();
            });
        });
    }

    private generateSubscribes(topics: Array<string>){
        let subscriberClasses = Array();

        //Getting all topics and breaking them into classes.
        topics.forEach(topic => {
            //Break topic into subscriber name and function
            const converter = ServiceUtility.convertToFunction(topic);

            //Adding unique sbuscriber objects into array.
            if(subscriberClasses.indexOf(converter.className) === -1){
                subscriberClasses.push(converter.className);
            }
        });

        subscriberClasses.forEach(subscriberClass => {
            const subscriber = new Subscriber(subscriberClass);
            topics.forEach(topic => {
                const converter = ServiceUtility.convertToFunction(topic);
                if(subscriberClass === converter.className){
                    const fn = function(parms?: any) {
                        return that.executeSubscribeFunction(topic, parms);
                    }
                    Object.defineProperty(subscriber, converter.functionName, {value: fn});
                }
            });
            this.constructor.prototype[subscriberClass] = subscriber;
        });
    }

    private executeSubscribeFunction(topic: string, parms?: any) {
        return new Promise((resolve, reject) => {
            that.client.subscribe(topic, (error: any) => {
                if (!error) {
                    console.log('Client: Subscribed to topic: %s', topic);

                    if(parms === undefined){
                        parms = true;
                    }
                    let payload = JSON.stringify({request: parms});
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

    public get(){
        //return all functions of the service.
    }
}

class Subscriber {
    name: string;

    constructor(name: string){
        this.name = name;
    }
}