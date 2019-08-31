//Import modules
import mosca from 'mosca';
import { EventEmitter } from 'events';

//Interface: IMessage
interface IMessage {
    body: string;
}

//Interface: IReply
interface IReply {
    body: PublishHandlerReply;
    send(body: PublishHandlerReply): void;
}

//Interface: PublishHandlerReply
interface PublishHandlerReply {}

//Types: PublishHandler
type PublishHandler = (message: IMessage, reply: IReply) => void;

export default class ComBroker {
    private mosca: mosca.Server;
    private messageHandler: EventEmitter;

    //Default Constructor
    constructor(){
        //Load message emitter.
        this.messageHandler = new EventEmitter();
    }

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

                //creating new parms and adding to message Emitter.
                const message = new Message();
                const reply = new Reply();
                this.messageHandler.emit(topic, message, reply);
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
    public publish(path: string, handler: PublishHandler){
        this.messageHandler.on(path, handler);
    }
}

class Message implements IMessage{
    body: string;

    constructor(){
        //const message: IMessage = JSON.parse(packet.payload.toString());
    }
}

class Reply implements IReply{
    body: PublishHandlerReply;

    constructor(){

    }

    send(body: PublishHandlerReply): void {
        console.log('body', body);
    }

    private sendReply(path: string, reply: IReply){
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
}