//Import modules
import EventEmitter from 'events';
import mqtt, { MqttClient, IPublishPacket as Packet } from 'mqtt'

import { Events } from "../store/events";
import { Defaults } from "../store/defaults";
import { IClient, ConnectionState } from "../types/component";
import { Comm, Topic, TopicHelper, Message, Reply, MessageParms, ReplyBody, ReplyError, Alias, Subscriber } from '../types/comm2';
import { Handshake } from '../types/comm';

//Types: Function
export declare type CommFunction = MessageFunction | TransactionFunction;
export declare type MessageFunction = (parms?: MessageParms) => Promise<ReplyBody>;
export declare type TransactionFunction = (parms?: MessageParms) => NodeTransaction;

let that: CommClient;
export default class CommClient extends EventEmitter implements IClient {
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
    public comms: Array<NodeComm>;

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

        //Init Topic.
        this.broadcastTopic = Defaults.COMM_HANDSHAKE_TOPIC;
        this.comms = new Array();

        //Init Comm Handler Events.
        this._commHandlers = new EventEmitter();

        //Init Variables.
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
                    const comm = this.comms.find(comm => comm.topic === topic);

                    //Routing logic.
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

        //Convert Alias prototype to array and get each subscriber.
        Object.values(Object.getPrototypeOf(this.alias)).forEach(subscriber => {
            //Look for Subscriber class. 
            if(subscriber instanceof Subscriber){
                let subscribers = new Array();

                //Iterate through Subscriber and get dynamic functions.
                Object.entries(subscriber).forEach(([name, fn]) => {

                    //Look for dynamic function.
                    if(fn instanceof Function){
                        //Refer the dynamic function with the comm object to get additional details.
                        const comm = this.comms.find(comm => comm.functionName === name);

                        subscribers.push({
                            fn: name,
                            [fn.name.toUpperCase()]: comm.topic
                        });
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
    ///////Broadcast
    /////////////////////////
    /**
     * This fuction is called everytime a connection/re-connection is made to the Server.
     * 
     * @param packet 
     */
    private receiveBroadcast(packet: Packet){
        //Add listener first then receive reply
        this._commHandlers.once(this.broadcastTopic, (reply: NodeReply) => {
            if(reply.body !== undefined){
                this.generateAlias(reply.body as Handshake);
            }
        });

        //Receive reply
        this.receiveReply(packet);
    }

    /////////////////////////
    ///////Message/Reply 
    /////////////////////////
    private sendMessage(message: NodeMessage){
        //Subscribe to the topic.
        this._mqttClient.subscribe(message.topic);
    
        //Convert string to Json.
        const payload = JSON.stringify({message: {parms: message.parms}});

        //Publish message on Server
        this._mqttClient.publish(message.topic, payload, { qos: 2 }, () => {
            //Global Emit.
            this.emit(Events.NODE_SENT_MESSAGE, message);
        });
    }

    private receiveReply(packet: Packet){
        //Convert string to Json.
        const payload = JSON.parse(packet.payload.toString());

        //Validate if the payload is from the Server or node.
        if(payload.reply !== undefined && payload.message === undefined){
            //Unsubscribe to the topic.
            this._mqttClient.unsubscribe(packet.topic);

            //creating new reply parm.
            const reply = this.createReply(packet.topic, payload.reply.body, payload.reply.error);

            this._commHandlers.emit(packet.topic, reply);
            
            //Global Emit.
            this.emit(Events.NODE_RECEIVED_REPLY, reply);
        }
    }

    /////////////////////////
    ///////Transaction 
    /////////////////////////
    private receiveTransaction(packet: Packet){
        //console.log('Node', packet);

        //TODO: Stage 2
        //Step 1: Check topics.
        //Step 2: Based on topics emit events.
    }

    /////////////////////////
    ///////Handle Functions
    /////////////////////////
    public message(topic: Topic, parms: MessageParms){
        return new Promise<ReplyBody>((resolve, reject) => {
            if(this.connected){
                //Add Listener first. This will listen to reply from Server.
                this._commHandlers.once(topic, (reply: NodeReply) => {
                    if(reply.body !== undefined){
                        resolve(reply.body);
                    }else{
                        reject(reply.error);
                    }
                });

                //Creating new message.
                const message = this.createMessage(topic, parms);

                //Sending message
                this.sendMessage(message);
            }else{
                reject(new CommNodeUnavailableError(this.url));
            }
        });
    }

    public transaction(topic: Topic, parms: MessageParms){
        if(this.connected){
            //Creating new transaction.
            const transaction = new NodeTransaction();

            //Creating Transaction Topics
            const transactionTopic = new TopicHelper(topic).transaction;

            //Creating new message.
            const prepareMessage = this.createMessage(topic, parms);
            const commitMessage = this.createMessage(transactionTopic.commit, { commit: true });
            const rollbackMessage = this.createMessage(transactionTopic.rollback, { rollback: true });

            //Add Listeners
            // transaction._event.once(Events.TRANSACTION_PREPARE, () => this.sendMessage(prepareMessage));
            // transaction._event.once(Events.TRANSACTION_COMMIT, () => this.sendMessage(commitMessage));
            // transaction._event.once(Events.TRANSACTION_ROLLBACK, () => this.sendMessage(rollbackMessage));

            return transaction;
        }else{
            throw new CommNodeUnavailableError(this.url);
        }
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
    private generateAlias(handshake: Handshake){
        //Re-/Initialize alias and comms. All the subscribers will be added to this dynamically.
        this.alias = new Alias(handshake.name);
        this.comms = new Array();

        //Convert comms into subscribers with dynamic functions.
        handshake.messageReplys.forEach(topic => {
            //Covert the topic to class and function.
            const breakTopic = new TopicHelper(topic.topic);
            const subscriberName = breakTopic.className;
            const functionName = breakTopic.functionName;

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
                const message: MessageFunction = function(parms?: MessageParms) {
                    const _topic = topic.topic;
                    return that.message(_topic, parms);
                }

                //Assing reply function to Subscriber class.
                Object.defineProperty(subscriber, functionName, {value: message, enumerable: true, writable: true});
                
                //     const transaction: TransactionFunction = function(parms?: MessageParms) {
                //         const _topic = topic;
                //         return that.transaction(_topic, parms);
                //     }

                //     //Assing transaction function to Subscriber class.
                //     Object.defineProperty(subscriber, functionName, {value: transaction, enumerable: true, writable: true});
                //     break;
            }

            //Add comm to comms.
            this.comms.push({topic: topic.topic, functionName: functionName});

            //Adding the Subscriber class to Alias class.
            Object.getPrototypeOf(this.alias)[subscriberName] = subscriber;
        });
    }
}

/////////////////////////
///////Comm
/////////////////////////
export interface NodeComm extends Comm {
    functionName: string;
}

/////////////////////////
///////Message
/////////////////////////
export class NodeMessage extends Message {
    constructor(topic: Topic, parms: MessageParms){
        super(topic, parms);
    }
}

/////////////////////////
///////Reply
/////////////////////////
export class NodeReply extends Reply {
    constructor(topic: Topic, body: ReplyBody, error: ReplyError){
        super(topic, body, error);
    }
}

/////////////////////////
///////Transaction
/////////////////////////
export class NodeTransaction {
    //TODO: Need to add unique id.

    private _prepared: boolean;
    private _committed: boolean;
    private _rolledback: boolean;

    public readonly _event: EventEmitter;

    constructor(){
        this._prepared = false;
        this._committed = false;
        this._rolledback = false;

        this._event = new EventEmitter();
    }

    public prepare(){
        return new Promise<ReplyBody>((resolve, reject) => {
            if(!this._prepared){
                this._prepared = true;
                resolve();

                //Add Listener first.
                //this._event.once(Events.TRANSACTION_PREPARED, (data) => resolve(data));
    
                //Emit.
                // this._event.emit(Events.TRANSACTION_PREPARE);
            }else{
                reject(new TransactionWarning('Transaction already prepared.'));
            }
        });
    }

    public commit(){
        return new Promise<boolean>((resolve, reject) => {
            if(!this._committed){
                this._committed = true;
                resolve();

                //Add Listener first.
                //this._event.once(Events.TRANSACTION_COMMITTED, (data) => resolve(data));
    
                //Emit.
                // this._event.emit(Events.TRANSACTION_COMMIT);
            }else{
                reject(new TransactionWarning('Transaction already committed.'));
            }
        });
    }

    public rollback(){
        return new Promise<boolean>((resolve, reject) => {
            if(!this._rolledback){
                this._rolledback = true;
                resolve();

                //Add Listener first.
                //this._event.once(Events.TRANSACTION_ROLLEDBACK, (data) => resolve(data));
    
                //Emit.
                // this._event.emit(Events.TRANSACTION_ROLLBACK);
            }else{
                reject(new TransactionWarning('Transaction already rolledback.'));
            }
        });
    }

    public get prepared(){
        return this._prepared;
    }

    public get committed(){
        return this._committed;
    }

    public get rolledback(){
        return this._rolledback;
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

export class TransactionWarning extends Error {
    constructor (message: string) {
        super(message);
        
        // Saving class name in the property of our custom error as a shortcut.
        this.name = this.constructor.name;
    
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
      }
}