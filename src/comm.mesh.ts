//Import modules
import mqtt, { MqttClient } from 'mqtt'
import { EventEmitter } from 'events';

//Local Imports
import { Component } from './microservice';
import Utility from './utility';

//Types: ConnectionOptions
export type ConnectionOptions = {
    name: string,
    host: string,
    port: number,
    url: string
};

//Types: CommMeshInitOptions
export type CommMeshInitOptions = {
    mesh: Array<string>
}

export default class CommMesh implements Component {
    //Options
    private initOptions: CommMeshInitOptions;

    //Nodes
    private nodes: Array<Node> = new Array<Node>();

    //Default Constructor
    constructor(){}

    /////////////////////////
    ///////Gets/Sets
    /////////////////////////
    public getNodes(){
        return this.nodes;
    }

    public getNodeAlias(name: string){
        const node = this.nodes.find(node => node.name === name);

        if(node !== undefined){
            return node.getAlias();
        }else{
            throw new Error('Invalid node. Node not defined as mesh.');
        }
    }

    public getOptions() {
        return {initOptions: this.initOptions};
    }

    public getReport() {
        let nodes = new Array();

        this.nodes.forEach((node) => {
            nodes.push(node.getReport());
        });

        const report = {
            nodes: nodes
        };
        return report;
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public init(initOptions: CommMeshInitOptions){
        //Load init options.
        this.initOptions = initOptions;
        this.initOptions.mesh = initOptions.mesh || [];

        //Load Nodes
        this.createNodes(this.initOptions.mesh);
    }

    /////////////////////////
    ///////Map Functions
    /////////////////////////
    private createNodes(hosts: Array<string>){
        hosts.forEach(host => {
            //Creating node object.
            const node = new Node(host);

            //Add to Array
            this.nodes.push(node);
        });
    }

    /////////////////////////
    ///////Start/Stop Functions
    /////////////////////////
    public connect(){
        return new Promise((resolve, reject) => {
            this.nodes.forEach((node, index) => {
                node.connect()
                    .then(() => {
                        if(this.nodes.length === index + 1){
                            resolve();
                        }
                    })
            });
        });
    }

    public disconnect(){
        return new Promise((resolve, reject) => {
            if(this.nodes.length > 0){
                this.nodes.forEach((node, index) => {
                    node.disconnect()
                        .then(() => {
                            if(this.nodes.length === index + 1){
                                resolve();
                            }
                        })
                });
            }else{
                resolve();
            }
        });
    }
}

export class Node {
    //Default Name.
    public readonly name: string;

    //Options
    private connectionOptions: ConnectionOptions;

    //MQTT Client
    private mqttClient: MqttClient;
    
    //Topic Objects
    public readonly broadcastTopic = '/';
    private topics: Array<string>;
    private messageCallbackEvent: EventEmitter;

    //Alias
    private alias: Alias;

    //Default Constructor
    constructor(host: string){
        this.name = host;

        //Split url into host and port.
        const _url = host.split(':');
        const _host = _url[0];
        const _port = Number(_url[1]) || global.service.comBrokerPort;

        this.connectionOptions = {
            name: global.service.name,
            host: _host,
            port: _port,
            url: 'mqtt://' + _host + ':' + _port,
        }

        //Array of topics
        this.topics = new Array<string>();

        //Create alias object
        this.alias = new Alias();

        //Load message callback emitter.
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

    public getTopics() {
        return this.topics;
    }

    public getAlias(){
        return this.alias;
    }

    public getOptions() {
        return {connectionOptions: this.connectionOptions};
    }
    
    public getReport(){
        try{
            const report = {
                init: {
                    broadcastTopic: this.broadcastTopic,
                    host: this.connectionOptions.host,
                    port: this.connectionOptions.port,
                    connected: this.connected,
                    reconnecting: this.reconnecting,
                    disconnected: this.disconnected
                },
                topics: this.topics
            };
            return report;
        }catch(error){
            return {}
        }
    }

    /////////////////////////
    ///////Start/Stop Functions
    /////////////////////////
    public connect(){
        return new Promise((resolve, reject) => {
            //Set options
            const options = {
                id: this.connectionOptions.name,
                keepalive: 30
            };

            //Init Connection object
            this.mqttClient = mqtt.connect(this.connectionOptions.url, options);

            //Return.
            resolve();
    
            //mqttClient listeners.
            this.mqttClient.on('connect', () => {
                console.log('Node: Connected to : %s', this.connectionOptions.url);

                //Subscribe to all topics.
                this.mqttClient.subscribe(this.broadcastTopic);
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
                console.log('Node: Disconnected from : %s', this.connectionOptions.url);
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
                reject(new NodeUnavailableError(this.connectionOptions.host));
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