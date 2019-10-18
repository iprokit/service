//Import modules
import mqtt from 'mqtt'
import { EventEmitter } from 'events';

//Local Imports
import { Component } from './microservice';
import CommUtility from './comm.utility';

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

export function getService(name: string){
    const commClientObject = commClients.find(client => client.host === name);
    if(commClientObject !== undefined){
        return commClientObject.client.getService();
    }else{
        throw new Error('Invalid service. Service not defined as mesh at entry point.');
    }
}

//Clients
var commClients: Array<{host: string, client: CommClient}> = new Array<{host: string, client: CommClient}>();

export default class CommMesh implements Component {
    //Options
    private initOptions: CommMeshInitOptions;

    //Default Constructor
    constructor(){}

    /////////////////////////
    ///////Gets/Sets
    /////////////////////////
    public getOptions() {
        return {initOptions: this.initOptions};
    }

    public getReport() {
        let clients = new Array();

        commClients.forEach((client) => {
            clients.push(client.client.getReport());
        });

        const report = {
            clients: clients
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

        //Load Clients
        this.createCommClients(this.initOptions.mesh);
    }

    /////////////////////////
    ///////Map Functions
    /////////////////////////
    private createCommClients(hosts: Array<string>){
        hosts.forEach(host => {
            //Creating comm client object.
            const commClient = new CommClient(host);

            //Add to Array
            commClients.push({host: host, client: commClient});
        });
    }

    /////////////////////////
    ///////Start/Stop Functions
    /////////////////////////
    public connect(){
        return new Promise((resolve, reject) => {
            let urls = new Array();
            commClients.forEach((commClient) => {
                //Connect to comm client
                commClient.client.connect()
                    .then((url) => {
                        urls.push(url);
                    })
                    .finally(() => {
                        resolve(urls);
                    })
            });
        });
    }

    public disconnect(){
        return new Promise((resolve, reject) => {
            //Close Comm Client connections.
            if(commClients.length === 0){
                resolve();
            }else{
                commClients.forEach((commClient) => {
                    const _commClient = commClient.client;
                    _commClient.disconnect()
                        .finally(() => {
                            resolve();
                        });
                });
            }
        });
    }
}

class CommClient {
    //Options
    private connectionOptions: ConnectionOptions;

    //MQTT Client
    private mqttClient: mqtt.MqttClient;
    
    //Topic Objects
    public readonly broadcastTopic = '/';
    private topics: Array<string>;
    private messageCallbackEvent: EventEmitter;

    //Service
    private service: Service;

    //Default Constructor
    constructor(host: string){
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

        //Create service object
        this.service = new Service();

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

    public getService(){
        return this.service;
    }

    public getOptions() {
        return {connectionOptions: this.connectionOptions};
    }
    
    public getReport(){
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
    
            this.mqttClient.on('connect', () => {
                //Subscribe to all topics.
                this.mqttClient.subscribe(this.broadcastTopic);

                //Return.
                resolve({url: this.connectionOptions.url});
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
            this.mqttClient.end(true, () => {
                resolve(this.connectionOptions.url);
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
                this.service.name = reply.body.name;
                this.topics = reply.body.topics;

                this.mqttClient.subscribe(this.topics);
                this.generateService(this.topics);
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
            console.log('Client: published a message on topic: %s', topic);
        });
    }

    private receiveReply(packet: any){
        //Convert string to Json.
        const payload = JSON.parse(packet.payload.toString());

        //Validate if the payload is from the broker or client.
        if(payload.reply !== undefined && payload.message === undefined){
            //Logging Message
            console.log('Client: received a reply on topic: %s', packet.topic);

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
            if(this.mqttClient.connected){
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
                reject(new ServiceUnavailableError(this.connectionOptions.host));
            }
        });
    }

    /////////////////////////
    ///////Generate Functions
    /////////////////////////
    private generateService(topics: Array<string>){
        //Convert topics into subscribers with dynamic functions.
        topics.forEach(topic => {
            const converter = CommUtility.convertToFunction(topic);

            if(converter){
                let subscriber;

                //Validate and generate a subscriber object or get it from service class object.
                if(this.service.constructor.prototype[converter.className] === undefined){
                    subscriber = new Subscriber(converter.className, this);
                }else{
                    subscriber = this.service.constructor.prototype[converter.className];
                }

                //Validate and generate dynamic funcation and add it to subscriber object.
                if(subscriber[converter.functionName] === undefined){
                    const subscribe = function(parms?: any) {
                        const _topic = topic;
                        return this.commClient.message(_topic, parms);
                    }
                    Object.defineProperty(subscriber, converter.functionName, {value: subscribe});
                }

                //Adding the subscriber object to service class object.
                this.service.constructor.prototype[converter.className] = subscriber;
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
///////Subscriber
/////////////////////////
export class Subscriber {
    public name: string;
    private commClient: CommClient;

    constructor(name: string, commClient: CommClient){
        this.name = name;
        this.commClient = commClient;
    }
}

/////////////////////////
///////Service
/////////////////////////
export class Service {
    name: string;
}

/////////////////////////
///////Error Classes
/////////////////////////
export class ServiceUnavailableError extends Error{
    constructor (name: string) {
        super(name + ' service is unavailable.');
        
        // Saving class name in the property of our custom error as a shortcut.
        this.name = name;
    
        // Capturing stack trace, excluding constructor call from it.
        Error.captureStackTrace(this, this.constructor);
      }
}