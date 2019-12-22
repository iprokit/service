//Import modules
import { EventEmitter } from 'events';
import mqtt, { MqttClient, IPublishPacket as Packet } from 'mqtt'

//Local Imports
import { Client, Events, Defaults, ConnectionState } from './microservice';
import { Comm, CommMethod, Topic, Message, Reply, MessageParms, ReplyBody, ReplyError, Alias, Subscriber, Broadcast } from './comm';
import Utility from './utility';

let that: CommNode;

export default class CommNode extends EventEmitter implements Client {
    //CommNode Variables.
    public readonly identifier: string;
    public readonly name: string;
    public readonly url: string; //host+port
    public readonly host: string;
    public readonly port: number;

    //MQTT Client
    private _mqttClient: MqttClient;
    
    //Topic Objects
    public readonly broadcastTopic: Topic;

    //Comm Handler Events
    private readonly _commHandlers: EventEmitter;

    //Alias
    public alias: Alias;

    //Default Constructor
    constructor(name: string, url: string, identifier: string){
        //Call super for EventEmitter.
        super();

        //Alternative to this.
        that = this;

        //Init comm node variables.
        this.name = name;
        this.url = url;
        this.identifier = identifier;

        //Split url into host and port.
        const _url = this.url.split(':');
        this.host = _url[0];
        this.port = Number(_url[1]) || Defaults.COMM_PORT;

        //Init variables.
        this.broadcastTopic = Defaults.BROADCAST_TOPIC;
        this._commHandlers = new EventEmitter();
        this.alias = new Alias();
    }

    /////////////////////////
    ///////Gets/Sets
    /////////////////////////
    public get connected() {
        return this._mqttClient.connected;
    }

    public get reconnecting() {
        return this._mqttClient.reconnecting;
    }

    public get disconnected() {
        return this._mqttClient.disconnected;
    }

    /////////////////////////
    ///////Start/Stop Functions
    /////////////////////////
    public async connect(){
        return new Promise<ConnectionState>((resolve, reject) => {
            //Init Connection object
            this._mqttClient = mqtt.connect('mqtt://' + this.host + ':' + this.port, {
                clientId: this.name,
                keepalive: 30
            });

            //mqttClient listeners.
            this._mqttClient.on('connect', () => {
                //Subscribe to all topics.
                this._mqttClient.subscribe(this.broadcastTopic);

                this.emit(Events.NODE_CONNECTED, this);
                resolve(1);
            });
            
            this._mqttClient.on('message', (topic: string, payload: Buffer, packet: Packet) => {
                //Receive broadcast
                if(topic === this.broadcastTopic){
                    this.receiveBroadcast(packet);
                }else{
                    this.receiveReply(packet);
                }
            });
        });
    }

    public async disconnect(){
        return new Promise<ConnectionState>((resolve, reject) => {
            this._mqttClient.end(false, () => {
                this.emit(Events.NODE_DISCONNECTED, this);
                resolve(0);
            });
        });
    }

    /////////////////////////
    ///////Report
    /////////////////////////
    public getReport(){
        let alias: {[name: string]: string[]} = {};

        //Convert Alias prototype to array and get each _subscriber.
        Object.values(Object.getPrototypeOf(this.alias)).forEach(subscriber => {
            //Look for Subscriber class. 
            if(subscriber instanceof Subscriber){
                let subscribers = new Array();

                //Iterate through Subscriber and get message functions.
                Object.entries(subscriber).forEach(([name, fn])=> {
                    //TODO: Work from here.
                    console.log(name, fn);

                    //Look for message function.
                    if(fn instanceof Function){

                        //Push message function to Subscriber array.
                        subscribers.push(name);
                    }
                });
                
                //Add Subscriber to Alias.
                alias[subscriber.name] = subscribers;
            }
        });
        return {
            identifier: this.identifier,
            name: this.alias.name,
            host: this.host,
            port: this.port,
            connected: this.connected,
            reconnecting: this.reconnecting,
            disconnected: this.disconnected,
            alias: alias
        }
    }

    /////////////////////////
    ///////Broadcast Functions
    /////////////////////////
    /**
     * This fuction is called everytime a connection/re-connection is made to the broker.
     * 
     * @param packet 
     */
    private receiveBroadcast(packet: Packet){
        //Add listener first then receive reply
        this._commHandlers.once(this.broadcastTopic, (reply: NodeReply) => {
            if(reply.body !== undefined){
                this.generateAlias(reply.body as Broadcast);
            }
        });

        //Receive reply
        this.receiveReply(packet);
    }

    /////////////////////////
    ///////Comm Functions 
    /////////////////////////
    private sendMessage(message: NodeMessage){
        //Convert string to Json.
        const payload = JSON.stringify({message: {parms: message.parms}});

        //Publish message on broker
        this._mqttClient.publish(message.topic, payload, { qos: 0 }, () => {
            //Global Emit.
            this.emit(Events.NODE_SENT_MESSAGE, message);
        });
    }

    private receiveReply(packet: Packet){
        //Convert string to Json.
        const payload = JSON.parse(packet.payload.toString());

        //Validate if the payload is from the broker or node.
        if(payload.reply !== undefined && payload.message === undefined){
            //creating new reply parm.
            const reply = this.createReply(packet.topic, payload.reply.body, payload.reply.error);

            this._commHandlers.emit(packet.topic, reply);

            //Global Emit.
            this.emit(Events.NODE_RECEIVED_REPLY, reply);
        }
    }

    /////////////////////////
    ///////Handle Functions
    /////////////////////////
    public message(topic: Topic, parms: MessageParms){
        return new Promise<ReplyBody>((resolve, reject) => {
            if(this.connected){
                //Add Listener first. This will listen to reply from broker.
                this._commHandlers.once(topic, (reply: NodeReply) => {
                    //Unsubscribe to the topic.
                    this._mqttClient.unsubscribe(topic);

                    //Send promise back to the user.
                    if(reply.body !== undefined){
                        resolve(reply.body);
                    }else{
                        reject(reply.error);
                    }
                });

                //Creating new message.
                const message = this.createMessage(topic, parms);

                //Subscribe to the topic.
                this._mqttClient.subscribe(topic);

                //Sending message
                this.sendMessage(message);
            }else{
                reject(new CommNodeUnavailableError(this.url));
            }
        });
    }

    public transaction(topic: Topic, parms: MessageParms){
        return new Promise<ReplyBody>((resolve, reject) => {
            
        });
    }

    /////////////////////////
    ///////create Functions
    /////////////////////////
    /**
     * Creates a new Message object.
     * 
     * @param topic
     * @param parms 
     * @returns the new message object created.
     */
    private createMessage(topic: Topic, parms: MessageParms){
        const message = new NodeMessage(topic, parms);
        return message;
    }

    /**
     * Creates a new Reply object.
     * @param topic 
     * @returns the new reply object created.
     */
    private createReply(topic: Topic, body: ReplyBody, error: ReplyError){
        const reply = new NodeReply(topic, body, error);

        return reply;
    }

    /////////////////////////
    ///////Core Functions
    /////////////////////////
    private generateAlias(broadcast: Broadcast){
        //Re-/Initialize alias class. All the subscribers will be added to this dynamically.
        this.alias = new Alias(broadcast.name);

        //Convert comms into subscribers with dynamic functions.
        broadcast.comms.forEach(comm => {
            //Covert the topic to class and function.
            const converter = Utility.convertToFunction(comm.topic);
            const subscriberName = converter.className;
            const functionName = converter.functionName;

            if(converter){
                let subscriber: Subscriber;

                //Validate and generate a Subscriber class or get it from Alias class.
                //This step is to retian unique subscribes.
                if(Object.getPrototypeOf(this.alias)[subscriberName] === undefined){
                    subscriber = new Subscriber(subscriberName);
                }else{
                    subscriber = Object.getPrototypeOf(this.alias)[subscriberName];
                }

                //Validate and generate dynamic funcation.
                if(Object.getPrototypeOf(subscriber)[functionName] === undefined){
                    //Create a new dynamic funcation based on the method.
                    switch(comm.method){
                        case 'reply':
                            const message = function(parms?: MessageParms) {
                                const _topic = comm.topic;
                                return that.message(_topic, parms);
                            }

                            //Assing message function to Subscriber class.
                            Object.defineProperty(subscriber, functionName, {value: message, enumerable: true, writable: true});
                            break;
                        case 'transaction':
                            const transaction = function(parms?: MessageParms) {
                                const _topic = comm.topic;
                                return that.transaction(_topic, parms);
                            }

                            //Assing transaction function to Subscriber class.
                            Object.defineProperty(subscriber, functionName, {value: transaction, enumerable: true, writable: true});
                            break;
                    }
                }

                //Adding the Subscriber class to Alias class.
                Object.getPrototypeOf(this.alias)[subscriberName] = subscriber;
            }
        });
    }
}

/////////////////////////
///////Comm
/////////////////////////
export interface NodeComm extends Comm {}

/////////////////////////
///////Message
/////////////////////////
export class NodeMessage extends Message{
    constructor(topic: Topic, parms: MessageParms){
        super(topic, parms);
    }
}

/////////////////////////
///////Reply
/////////////////////////
export class NodeReply extends Reply{
    constructor(topic: Topic, body: ReplyBody, error: ReplyError){
        super(topic, body, error);
    }
}

/////////////////////////
///////Error Classes
/////////////////////////
export class CommNodeUnavailableError extends Error{
    constructor (name: string) {
        super(name + ' node is unavailable.');
        
        // Saving class name in the property of our custom error as a shortcut.
        this.name = name;
    
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
    }
}