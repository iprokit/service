//Import modules
import { Client } from 'mosca';

//Local Imports
import { mqttApp } from './app';
import ServiceUtility from './service.utility';

export default class ServicePublisher {

}

export function Publish() {
    return function (target: typeof ServicePublisher, propertyKey: string, descriptor: PropertyDescriptor) {
        const topic = ServiceUtility.convertToTopic(target, propertyKey);

        console.log(topic);

        mqttApp.on('subscribed', (topic, client: Client) => {
            console.log('Server: %s subscribed to topic: %s', client.id, topic);
        });

        mqttApp.on('published', (packet, client) => {
            if(packet.topic === topic){
                let payload = packet.payload.toString();
                console.log('Server: Recived a message: %o on topic: %s', payload, topic);

                payload = JSON.parse(payload)
                if(payload.request !== undefined){
                    const returnValue = descriptor.value(payload.request);

                    const message = {
                        topic: topic,
                        payload: JSON.stringify({response: returnValue}), // or a Buffer
                        qos: 0, // 0, 1, or 2
                        retain: false // or true
                      };
                      
                    mqttApp.publish(message, (object, packet) => {
                        console.log('Server: published a message: %o ', message);
                    });
                }
            }
        });
        //TODO: Work from here.
    }
}