//Import modules
import { Client } from 'mosca';

//Local Imports
import { mqttApp } from './app';
import ServiceUtility from './service.utility';

export default class ServicePublisher {}

export function Publish() {
    return function (target: typeof ServicePublisher, propertyKey: string, descriptor: PropertyDescriptor) {
        const topic = ServiceUtility.convertToTopic(target, propertyKey);
        
        mqttApp.on('subscribed', (topic, client: Client) => {
            console.log('Server: %s subscribed to topic: %s', client.id, topic);
        });

        mqttApp.on('published', (packet, client) => {
            if(packet.topic === topic){
                let payload = packet.payload.toString();
                console.log('Server: Recived a message: %o on topic: %s', payload, topic);

                payload = JSON.parse(payload)
                if(payload.request !== undefined){
                    const returnValue = descriptor.value(payload);

                    const message = {
                        topic: topic,
                        payload: JSON.stringify({response: returnValue}),
                        qos: 0,
                        retain: false
                      };
                      
                    mqttApp.publish(message, (object, packet) => {
                        console.log('Server: published a message: %o ', message);
                    });
                }
            }
        });
    }
}