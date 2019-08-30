//Import modules
import { Client } from 'mosca';

//Local Imports
import { moscaApp } from './app';
import ServiceUtility from './service.utility';

export default class ServicePublisher {
    private getTopics(){

    }
}

/////////////////////////
///////Decorators
/////////////////////////
export function Publish() {
    return function (target: typeof ServicePublisher, propertyKey: string, descriptor: PropertyDescriptor) {
        const topic = ServiceUtility.convertToTopic(target, propertyKey);
        
        moscaApp.on('subscribed', (topic, client: Client) => {
            console.log('Server: %s subscribed to topic: %s', client.id, topic);
        });

        //TODO: Work from here, issue with payload
        moscaApp.on('published', (packet, client) => {
            if(packet.topic === topic){
                const payload = packet.payload.toString();
                console.log('Server: Recived a message: %o on topic: %s', payload, topic);

                const _payload = JSON.parse(payload)
                if(_payload.request !== undefined){
                    const returnValue = descriptor.value(_payload);

                    const message = {
                        topic: topic,
                        payload: JSON.stringify({response: returnValue}),
                        qos: 0,
                        retain: false
                      };
                      
                    moscaApp.publish(message, (object, packet) => {
                        console.log('Server: published a message: %o ', message);
                    });
                }
            }
        });
    }
}

function send(){

}