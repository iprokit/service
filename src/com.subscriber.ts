//Import modules
import mqtt from 'mqtt'

//Local Imports
import ComUtility from './com.utility';

var that: ComSubscriber;
export default class ComSubscriber {
    private client: mqtt.MqttClient;

    //Default Constructor
    constructor(serviceName: string){
        that = this;
        //Convert serviceName to url
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
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

    /////////////////////////
    ///////Other Functions
    /////////////////////////
    private generateSubscribes(topics: Array<string>){
        //Convert topics into subscribers with dynamic functions.
        topics.forEach(topic => {
            const converter = ComUtility.convertToFunction(topic);

            let subscriber;
            //Validate and grenrate a subscriber object or get it from this class object.
            if(this.constructor.prototype[converter.className] === undefined){
                subscriber = new Subscriber(converter.className);
            }else{
                subscriber = this.constructor.prototype[converter.className];
            }

            //Generate dynamic funcations and add it to subscriber object.
            const subscribe = function(reply?: any) {
                return that.executeSubscribeFunction(topic, reply);
            }
            Object.defineProperty(subscriber, converter.functionName, {value: subscribe});

            //Adding the subscriber object to this class object.
            this.constructor.prototype[converter.className] = subscriber;
        });
    }

    private executeSubscribeFunction(topic: string, reply?: any) {
        //TODO: convert to custom function.
        return new Promise((resolve, reject) => {
            that.client.subscribe(topic, (error: any) => {
                if (!error) {
                    console.log('Client: Subscribed to topic: %s', topic);

                    if(reply === undefined){
                        reply = true;
                    }
                    const payload = JSON.stringify({request: reply});
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

/////////////////////////
///////Subscriber
/////////////////////////
class Subscriber {
    name: string;

    constructor(name: string){
        this.name = name;
    }
}