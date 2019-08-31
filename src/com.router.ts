

export default class ComRouter {
    private routes: Array<{url: string, fn: Function}>;
    //Default Constructor
    constructor(){

    }

    //TODO: on listen call function.

    public publish(topic: string, fn: Function){
        //TODO: Add topic & fn to array


        // moscaApp.on('subscribed', (topic, client: Client) => {
        //     console.log('Server: %s subscribed to topic: %s', client.id, topic);
        // });

        // //TODO: Issue with payload
        // moscaApp.on('published', (packet, client) => {
        //     if(packet.topic === topic){
        //         const payload = packet.payload.toString();
        //         console.log('Server: Recived a message: %o on topic: %s', payload, topic);

        //         const _payload = JSON.parse(payload)
        //         if(_payload.request !== undefined){
        //             const returnValue = descriptor.value(_payload);

        //             const message = {
        //                 topic: topic,
        //                 payload: JSON.stringify({response: returnValue}),
        //                 qos: 0,
        //                 retain: false
        //               };
                      
        //             moscaApp.publish(message, (object, packet) => {
        //                 console.log('Server: published a message: %o ', message);
        //             });
        //         }
        //     }
        // });
    }
}