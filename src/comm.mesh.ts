//Import modules
import mqtt, { MqttClient } from 'mqtt'
import { EventEmitter } from 'events';

//Local Imports
import { ClientComponent, Defaults, Events } from './microservice';
import Utility from './utility';

export default class CommMesh extends EventEmitter implements ClientComponent {
    //Mesh Variables.
    private serviceName: string;

    //Nodes
    private readonly nodes: Array<Node>;

    //Default Constructor
    constructor(){
        //Call super for EventEmitter.
        super();

        //Init variables.
        this.nodes = new Array();
    }

    /////////////////////////
    ///////Gets/Sets
    /////////////////////////
    public getReport(){
        let nodes = new Array();

        this.nodes.forEach(node => {
            nodes.push(node.getReport());
        });

        return nodes;
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public init(serviceName: string){
        //Init connection variables
        this.serviceName = serviceName;
    }

    /////////////////////////
    ///////Map Functions
    /////////////////////////
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
        const node = new Node(url);
        node.init(this.serviceName);

        //Attaching events to node object.
        node.on(Events.NODE_CONNECTED, (node: Node) => {
            this.emit(Events.NODE_CONNECTED, {url: node.url});
        });
        node.on(Events.NODE_DISCONNECTED, (node: Node) => {
            this.emit(Events.NODE_DISCONNECTED, {url: node.url});
        });

        //Add to Array
        this.nodes.push(node);

        return node;
    }

    /////////////////////////
    ///////Start/Stop Functions
    /////////////////////////
    public connect(){
        return new Promise((resolve, reject) => {
            if(this.nodes.length > 0){
                this.emit(Events.MESH_CONNECTING);
                this.nodes.forEach((node, index) => {
                    node.connect();
                    if(this.nodes.length === index + 1){
                        resolve();
                    }
                });
            }else{
                resolve();
            }
        })
    }

    public disconnect(callback?: Function){
        return new Promise((resolve, reject) => {
            if(this.nodes.length > 0){
                this.emit(Events.MESH_DISCONNECTING);
                this.nodes.forEach((node, index) => {
                    node.disconnect();
                    if(this.nodes.length === index + 1){
                        this.emit(Events.MESH_DISCONNECTED);
                        resolve();
                    }
                });
            }else{
                resolve();
            }
        });
    }
}

export class Node extends EventEmitter implements ClientComponent {
    //Node Variables.
    public readonly url: string; //host+port
    private readonly host: string;
    private readonly port: number;
    private serviceName: string;

    //MQTT Client
    private mqttClient: MqttClient;
    
    //Topic Objects
    private readonly broadcastTopic: string;
    private topics: Array<string>;

    //Alias
    public readonly alias: Alias;

    //Message Events
    private readonly messageCallbackEvent: EventEmitter;

    //Default Constructor
    constructor(url: string){
        //Call super for EventEmitter.
        super();

        //Init node variables.
        this.url = url;

        //Split url into host and port.
        const _url = this.url.split(':');
        this.host = _url[0];
        this.port = Number(_url[1]) || Defaults.COMM_PORT;

        //Init variables.
        this.broadcastTopic = Defaults.BROADCAST_TOPIC;
        this.topics = new Array();
        this.alias = new Alias();
        this.messageCallbackEvent = new EventEmitter();
    }

    /////////////////////////
    ///////Gets/Sets
    /////////////////////////
    public get connected() {
        return this.mqttClient.connected;
    }

    public get reconnecting() {
        return this.mqttClient.reconnecting;
    }

    public get disconnected() {
        return this.mqttClient.disconnected;
    }
    
    public getReport(){
        return {
            init: {
                broadcastTopic: this.broadcastTopic,
                host: this.host,
                port: this.port,
                connected: this.connected,
                reconnecting: this.reconnecting,
                disconnected: this.disconnected
            },
            topics: this.topics
        }
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public init(serviceName: string){
        //Init connection variables
        this.serviceName = serviceName;
    }

    /////////////////////////
    ///////Start/Stop Functions
    /////////////////////////
    public connect(){
        return new Promise((resolve, reject) => {
            //Init Connection object
            const mqttUrl = 'mqtt://' + this.host + ':' + this.port;
            const options = {
                id: this.serviceName,
                keepalive: 30
            };
            this.mqttClient = mqtt.connect(mqttUrl, options);

            //mqttClient listeners.
            this.mqttClient.on('connect', () => {
                this.emit(Events.NODE_CONNECTED, this);

                //Subscribe to all topics.
                this.mqttClient.subscribe(this.broadcastTopic);

                resolve();
            });
            
            this.mqttClient.on('message', (topic, payload, packet) => {
                //Receive broadcast
                if(topic === this.broadcastTopic){
                    this.receiveBroadcast(packet);
                }else{
                    this.receiveReply(packet);
                }
            });
        });
    }

    public disconnect(){
        return new Promise((resolve, reject) => {
            this.mqttClient.end(false, () => {
                this.emit(Events.NODE_DISCONNECTED, this);
                resolve();
            });
        });
    }

    /////////////////////////
    ///////Broadcast Functions
    /////////////////////////
    private receiveBroadcast(packet: any){
        //Add listener then receive reply
        this.messageCallbackEvent.once(this.broadcastTopic, (reply: Reply) => {
            if(reply.body !== undefined){
                this.alias.name = reply.body.name;
                this.topics = reply.body.topics;

                this.mqttClient.subscribe(this.topics);
                this.generateAlias(this.topics);
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
        this.mqttClient.publish(topic, payload, { qos: 0 }, () => {
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

            this.messageCallbackEvent.emit(packet.topic, reply);
        }
    }

    /////////////////////////
    ///////Handle Functions
    /////////////////////////
    public message(topic: string, parms: any){
        return new Promise((resolve, reject) => {
            if(this.connected){
                //Listen for reply on broker
                this.messageCallbackEvent.once(topic, (reply: Reply) => {
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