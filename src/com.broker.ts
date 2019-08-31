//Import modules
import mosca, { Packet, Message } from 'mosca';
import { EventEmitter } from 'events';

//Interface: IMessage
interface IMessage {
    readonly path: string;
    readonly body: any;
}

//Interface: IReply
interface IReply {
    readonly path: string;
    send(body: any): void;
}

//Types: PublishHandler
type PublishHandler = (message: IMessage, reply: IReply) => void;

//Alternative for this.
var that: ComBroker;

export default class ComBroker {
    private mosca: mosca.Server;
    private messageHandler: EventEmitter;

    //Default Constructor
    constructor(){
        //Setting that as this.
        that = this

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
                try{
                    this.prepareMessageHandler(packet);
                }catch(error){
                    //Do nothing.
                }
            }
        });
    }

    public close(fn: Function){
        this.mosca.close(() => {
            fn();
        });
    }

    /////////////////////////
    ///////Prepare Functions
    /////////////////////////
    private prepareMessageHandler(packet: Packet){
        //Convert string to json.
        const payload = JSON.parse(packet.payload.toString());

        //Creating new parms and adding to message Emitter.
        const message = new ComMessage(packet.topic, payload.message.body);
        const reply = new ComReply(packet.topic);
        this.messageHandler.emit(packet.topic, message, reply);
    }

    public prepareReplyHandler(path: string, body: any){
        const message = {
            topic: path,
            payload: JSON.stringify({reply: body}),
            qos: 0,
            retain: false
        };
            
        this.mosca.publish(message, (object, packet) => {
            console.log('Server: published a message: %o ', message);
        });
    }

    /////////////////////////
    ///////Listener Functions
    /////////////////////////
    public publish(path: string, handler: PublishHandler){
        this.messageHandler.on(path, handler);
    }
}

/////////////////////////
///////ComMessage
/////////////////////////
class ComMessage implements IMessage{
    readonly path: string;
    readonly body: any;

    constructor(path: string, body: JSON){
        this.path = path;
        this.body = body;
    }
}

/////////////////////////
///////ComReply
/////////////////////////
class ComReply implements IReply{
    readonly path: string;

    constructor(path: string){
        this.path = path;
    }

    send(body: any): void {
        //TODO: need to handle this in a differnt way.
        that.prepareReplyHandler(this.path, body);
    }
}