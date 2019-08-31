//Import modules
import mosca from 'mosca';
import Events from 'events';

//Interface: Message
interface Message {
    body: string;
}

//Interface: Reply
interface Reply {
    body: PublishHandlerReply;
}

//Interface: PublishHandlerReply
interface PublishHandlerReply {}

//Types: PublishHandler
type PublishHandler = (message: Message) => PublishHandlerReply;

export default class ComBroker {
    private mosca: mosca.Server;

    private publishHandlers = new Array<{path: string, handler: PublishHandler}>();

    //Default Constructor
    constructor(){}

    /////////////////////////
    ///////Start/Stop Functions
    /////////////////////////
    public listen(port: number | string, fn: Function){
        const options = {
            id: global.service.name,
            port: port
        }
        
        this.mosca = new mosca.Server(options);

        this.mosca.on('ready', () => {
            fn();
        });

        this.mosca.on('published', (packet, client) => {
            const topic = packet.topic;
            if (!topic.includes('$SYS/')) { //Ignoring all default $SYS/ topics.
                const payload = JSON.parse(packet.payload.toString());
                //TODO: Need to check if this is a message from server or client.
                this.onMessage(topic, payload.message);
            }
        });
    }

    public close(fn: Function){
        this.mosca.close(() => {
            fn();
        });
    }

    /////////////////////////
    ///////Listener Functions
    /////////////////////////
    public onMessage(path: string, message: Message){
        this.publishHandlers.forEach(publishHandler => {
            if(path === publishHandler.path){
                const publishHandlerReply = publishHandler.handler(message);
                this.sendReply(path, {body: publishHandlerReply});
            }
        });
    }

    public sendReply(path: string, reply: Reply){
        const message = {
            topic: path,
            payload: JSON.stringify({reply: reply}),
            qos: 0,
            retain: false
        };

        console.log('Message', message);
            
        // moscaApp.publish(message, (object, packet) => {
        //     console.log('Server: published a message: %o ', message);
        // });
    }

    public publish(path: string, handler: PublishHandler){
        if(this.publishHandlers.indexOf({path, handler}) === -1){
            this.publishHandlers.push({path, handler});
        }
    }
}

/////////////////////////
///////Message Emitter
/////////////////////////
class MessageEmitter extends Events {}