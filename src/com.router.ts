interface Message {}
interface Reply {}

type MessageHandler = (message: Message) => Reply;
type ReplyHandler = (reply: Reply) => void;

export default class ComRouter {
    private messageHandlers = new Array<{path: string, messageHandler: MessageHandler}>();

    //Default Constructor
    constructor(){
        //Do nothing
    }

    //TODO: on listen call function.

    public publish(path: string, messageHandler: MessageHandler){
        this.messageHandlers.push({path, messageHandler});
    }
}

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