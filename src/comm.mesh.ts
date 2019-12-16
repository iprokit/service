//Import modules
import Promise from 'bluebird';
import { EventEmitter } from 'events';
import mqtt, { MqttClient } from 'mqtt'

//Local Imports
import { Client, Events, Defaults } from './microservice';
import Utility from './utility';

export default class CommMesh extends EventEmitter implements Client {
    //Mesh Variables.
    public readonly name: string;

    //Nodes
    private readonly nodes: Array<Node>;

    //Default Constructor
    constructor(){
        //Call super for EventEmitter.
        super();

        //Init Mesh variables.
        this.name = global.service.name;

        //Init variables.
        this.nodes = new Array();
    }

    /////////////////////////
    ///////Map Functions
    /////////////////////////
    public hasNode(){
        return (this.nodes.length > 0);
    }

    public getNodeAlias(url: string){
        //Try finding nodes.
        let node = this.nodes.find(node => node.url === url);

        if(!node){
            //No node found. creating a new node.
            node = this.createNode(url);
        }

        return node.alias;
    }
    
    private createNode(url: string){
        //Creating node object.
        const node = new Node(this.name, url);

        node.once(Events.NODE_CONNECTED, (node) => {
            this.emit(Events.NODE_CONNECTED, node);
        });

        node.once(Events.NODE_DISCONNECTED, (node) => {
            this.emit(Events.NODE_DISCONNECTED, node);
        });

        //Add to Array
        this.nodes.push(node);

        return node;
    }

    /////////////////////////
    ///////Start/Stop Functions
    /////////////////////////
    public connect(){
        return new Promise<boolean>((resolve, reject) => {
            this.emit(Events.MESH_CONNECTING);

            Promise.map(this.nodes, (node) => {
                return node.connect();
            }).then(() => {
                this.emit(Events.MESH_CONNECTED, this);
                resolve(true);
            }).catch((error) => {
                reject(error);
            });
        })
    }

    public disconnect(){
        return new Promise<boolean>((resolve, reject) => {
            this.emit(Events.MESH_DISCONNECTING);

            Promise.map(this.nodes, (node) => {
                return node.disconnect();
            }).then(() => {
                this.emit(Events.MESH_DISCONNECTED, this);
                resolve(true);
            }).catch((error) => {
                reject(error);
            });
        });
    }

    /////////////////////////
    ///////Report
    /////////////////////////
    public getReport(){
        let nodes = new Array();

        this.nodes.forEach(node => {
            nodes.push(node.getReport());
        });

        return nodes;
    }
}

export class Node extends EventEmitter implements Client {
    //Node Variables.
    public readonly name: string;
    public readonly url: string; //host+port
    public readonly host: string;
    public readonly port: number;

    //MQTT Client
    private _mqttClient: MqttClient;
    
    //Topic Objects
    private readonly _broadcastTopic: string;
    private _topics: Array<string>;

    //Alias
    public readonly alias: Alias;

    //Message Events
    private readonly _messageCallbackEvent: EventEmitter;

    //Default Constructor
    constructor(name: string, url: string){
        //Call super for EventEmitter.
        super();

        //Init node variables.
        this.name = name;
        this.url = url;

        //Split url into host and port.
        const _url = this.url.split(':');
        this.host = _url[0];
        this.port = Number(_url[1]) || Defaults.COMM_PORT;

        //Init variables.
        this._broadcastTopic = Defaults.BROADCAST_TOPIC;
        this._topics = new Array();
        this.alias = new Alias();
        this._messageCallbackEvent = new EventEmitter();
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
    public connect(){
        return new Promise<boolean>((resolve, reject) => {
            //Init Connection object
            const mqttUrl = 'mqtt://' + this.host + ':' + this.port;
            const options = {
                id: this.name,
                keepalive: 30
            };
            this._mqttClient = mqtt.connect(mqttUrl, options);

            //mqttClient listeners.
            this._mqttClient.on('connect', () => {
                //Subscribe to all topics.
                this._mqttClient.subscribe(this._broadcastTopic);

                this.emit(Events.NODE_CONNECTED, this);
                resolve(true);
            });
            
            this._mqttClient.on('message', (topic, payload, packet) => {
                //Receive broadcast
                if(topic === this._broadcastTopic){
                    this.receiveBroadcast(packet);
                }else{
                    this.receiveReply(packet);
                }
            });
        });
    }

    public disconnect(){
        return new Promise<boolean>((resolve, reject) => {
            this._mqttClient.end(false, () => {
                this.emit(Events.NODE_DISCONNECTED, this);
                resolve(true);
            });
        });
    }

    /////////////////////////
    ///////Report
    /////////////////////////
    public getReport(){
        return {
            init: {
                host: this.host,
                port: this.port,
                connected: this.connected,
                reconnecting: this.reconnecting,
                disconnected: this.disconnected
            },
            topics: this._topics
        }
    }

    /////////////////////////
    ///////Broadcast Functions
    /////////////////////////
    private receiveBroadcast(packet: any){
        //Add listener then receive reply
        this._messageCallbackEvent.once(this._broadcastTopic, (reply: Reply) => {
            if(reply.body !== undefined){
                this.alias.name = reply.body.name;
                this._topics = reply.body.topics;

                this._mqttClient.subscribe(this._topics);
                this.generateAlias(this._topics);
            }
        });

        this.receiveReply(packet);
    }

    /////////////////////////
    ///////Comm Functions 
    /////////////////////////
    private sendMessage(topic: string, message: Message){
        //Convert string to Json.
        const payload = JSON.stringify({message: message});

        //Publish message on broker
        this._mqttClient.publish(topic, payload, { qos: 0 }, () => {
            //Logging Message
            console.log('Node: published a message on topic: %s', topic);
        });
    }

    private receiveReply(packet: any){
        //Convert string to Json.
        const payload = JSON.parse(packet.payload.toString());

        //Validate if the payload is from the broker or node.
        if(payload.reply !== undefined && payload.message === undefined){
            //Logging Message
            console.log('Node: received a reply on topic: %s', packet.topic);

            //creating new reply parm.
            const reply = new Reply(payload.reply.body, payload.reply.error);

            this._messageCallbackEvent.emit(packet.topic, reply);
        }
    }

    /////////////////////////
    ///////Handle Functions
    /////////////////////////
    public message(topic: string, parms: any){
        return new Promise((resolve, reject) => {
            if(this.connected){
                //Listen for reply on broker
                this._messageCallbackEvent.once(topic, (reply: Reply) => {
                    if(reply.body !== undefined){
                        resolve(reply.body);
                    }else{
                        reject(reply.error);
                    }
                });

                //Creating new message parm.
                const message = new Message(parms);

                //Sending message
                this.sendMessage(topic, message);
            }else{
                reject(new NodeUnavailableError(this.url));
            }
        });
    }

    /////////////////////////
    ///////Generate Functions
    /////////////////////////
    private generateAlias(topics: Array<string>){
        //Convert topics into subscribers with dynamic functions.
        topics.forEach(topic => {
            const converter = Utility.convertToFunction(topic);

            if(converter){
                let subscriber;

                //Validate and generate a subscriber object or get it from alias class object.
                if(this.alias.constructor.prototype[converter.className] === undefined){
                    subscriber = new Subscriber(converter.className, this);
                }else{
                    subscriber = this.alias.constructor.prototype[converter.className];
                }

                //Validate and generate dynamic funcation and add it to subscriber object.
                if(subscriber[converter.functionName] === undefined){
                    const subscribe = function(parms?: any) {
                        const _topic = topic;
                        return this.node.message(_topic, parms);
                    }
                    Object.defineProperty(subscriber, converter.functionName, {value: subscribe});
                }

                //Adding the subscriber object to alias class object.
                this.alias.constructor.prototype[converter.className] = subscriber;
            }
        });
    }
}

/////////////////////////
///////Message
/////////////////////////
interface IMessage {
    parms: any;
}

export class Message implements IMessage{
    readonly parms: any;

    constructor(parms: any){
        this.parms = parms;
    }
}

/////////////////////////
///////Reply
/////////////////////////
interface IReply {
    body: any;
    error: any;
}

export class Reply implements IReply{
    readonly body: any;
    readonly error: any;

    constructor(body: any, error: any){
        this.body = body;
        this.error = error;
    }
}

/////////////////////////
///////Alias
/////////////////////////
//Holds subscribers.
export class Alias {
    name: string;
}

/////////////////////////
///////Subscriber
/////////////////////////
export class Subscriber {
    public name: string;
    private node: Node;

    constructor(name: string, node: Node){
        this.name = name;
        this.node = node;
    }
}

/////////////////////////
///////Error Classes
/////////////////////////
export class NodeUnavailableError extends Error{
    constructor (name: string) {
        super(name + ' node is unavailable.');
        
        // Saving class name in the property of our custom error as a shortcut.
        this.name = name;
    
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
    }
}