//Import modules
import mosca, { Packet } from 'mosca';
import { EventEmitter } from 'events';

//Interface: IMessage
interface IMessage {
    readonly topic: string;
    readonly parms: any;
}

//Interface: IReply
interface IReply {
    readonly topic: string;
    send(body: any): void;
    error(error: any): void;
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
                    this.handleMessage(packet);
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
    public publish(topic: string, handler: PublishHandler){
        if(this.topics.indexOf(topic) === -1){
            //Add topic to array
            this.topics.push(topic);
    
            //Add event listener.
            this.messageHandler.on(topic, handler);
        }
    }

    /////////////////////////
    ///////Handle Functions
    /////////////////////////
    private handleMessage(packet: Packet){
        //Convert string to Json.
        const payload = JSON.parse(packet.payload.toString());

        //Validate if the payload is from the publisher(broker) or subscriber(client).
        if(payload.message !== undefined && payload.reply === undefined){
            //Logging Message
            console.log('Broker: received a message: %o', payload.message);

            //New parms.
            const message = new Message(packet.topic, payload.message.parms);
            const reply = new Reply(packet.topic);

            //Passing parms to message Emitter
            this.messageHandler.emit(packet.topic, message, reply);
        }
    }

    public handleReply(topic: string, reply: any){
        //Covert Json to string.
        const packet = {
            topic: topic,
            payload: JSON.stringify({reply: reply}),
            qos: 0,
            retain: false
        };

        //Publish message on broker
        this.mosca.publish(packet, () => {
            //Logging Reply
            console.log('Broker: published a reply: %o ', reply);
        });
    }
}

/////////////////////////
///////Message
/////////////////////////
class Message implements IMessage{
    readonly topic: string;
    readonly parms: any;

    constructor(topic: string, parms: any){
        this.topic = topic;
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
        that.handleReply(this.topic, { body: body });
    }

    error(error: any): void {
        that.handleReply(this.topic, { error: error });
    }
}