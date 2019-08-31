//Import modules
import mosca, { Packet } from 'mosca';
import { EventEmitter } from 'events';

//Interface: IMessage
interface IMessage {
    readonly topic: string;
    readonly body: any;
    readonly parms: any;
}

//Interface: IReply
interface IReply {
    readonly topic: string;
    send(body: any): void;
}

//Types: PublishHandler
export type PublishHandler = (message: Message, reply: Reply) => void;

//Alternative for this.
var that: CommBroker;

export default class CommBroker {
    private mosca: mosca.Server;

    private topics: Array<string>;
    private messageHandler: EventEmitter;

    //Default Constructor
    constructor(){
        //Setting that as this.
        that = this

        //Array of topics
        this.topics = new Array<string>();

        //Load message emitter.
        this.messageHandler = new EventEmitter();

        //Create report publish.
        this.publish('/', function(message: Message, reply: Reply){
            reply.send(that.topics);
        });
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
    ///////Router Functions
    /////////////////////////
    public publish(path: string, handler: PublishHandler){
        if(this.topics.indexOf(path) === -1){
            //Add path to array
            this.topics.push(path);
    
            //Add listener to path.
            this.messageHandler.on(path, handler);
        }
    }

    /////////////////////////
    ///////Prepare Functions
    /////////////////////////
    private prepareMessageHandler(packet: Packet){
        //Convert string to Json.
        const payload = JSON.parse(packet.payload.toString());

        //Validate if the payload is from the publisher(broker) or subscriber(client).
        if(payload.message !== undefined && payload.reply === undefined){
            //Logging Message
            console.log('Server: received a message: %o', payload.message);

            //New parms.
            const message = new Message(packet.topic, payload.message.body, payload.message.parms);
            const reply = new Reply(packet.topic);

            //Passing parms to message Emitter
            this.messageHandler.emit(packet.topic, message, reply);
        }
    }

    public prepareReplyHandler(path: string, body: any){
        const reply = {
            body: body
        }
        //Covert Json to string.
        const packet = {
            topic: path,
            payload: JSON.stringify({reply: reply}),
            qos: 0,
            retain: false
        };

        //Publish message on broker
        this.mosca.publish(packet, () => {
            //Logging Reply
            console.log('Server: published a reply: %o ', reply);
        });
    }
}

/////////////////////////
///////Message
/////////////////////////
class Message implements IMessage{
    readonly topic: string;
    readonly body: any;
    readonly parms: any;

    constructor(topic: string, body: any, parms: any){
        this.topic = topic;
        this.body = body;
        this.parms = parms;
    }
}

/////////////////////////
///////Reply
/////////////////////////
class Reply implements IReply{
    readonly topic: string;

    constructor(topic: string){
        this.topic = topic;
    }

    send(body: any): void {
        that.prepareReplyHandler(this.topic, body);
    }
}