//Types
export type Topic = string | BroadcastTopic;
export type MessageParms = Object;
export type ReplyBody = Object | Broadcast;
export type ReplyError = Object;

export type BroadcastTopic = '/';
export interface Broadcast extends Object {
    name: string,
    comms: Array<Comm>
};

/////////////////////////
///////Comm
/////////////////////////
export type CommMethod = 'reply' | 'transaction';
export interface Comm {
    method: CommMethod;
    topic: Topic;
}

/////////////////////////
///////Message
/////////////////////////
interface IMessage {
    topic: Topic;
    parms: MessageParms;
}
export class Message implements IMessage {
    public readonly topic: Topic;
    public readonly parms: MessageParms;

    constructor(topic: Topic, parms: MessageParms){
        this.topic = topic;
        this.parms = parms;
    }
}

/////////////////////////
///////Reply
/////////////////////////
interface IReply {
    topic: Topic;
    body: ReplyBody;
    error: ReplyError;
}
export class Reply implements IReply {
    public readonly topic: Topic;
    protected _body: ReplyBody;
    protected _error: ReplyError;

    constructor(topic: Topic, body?: ReplyBody, error?: ReplyError){
        this.topic = topic;
        this._body = body;
        this._error = error;
    }

    get body(){
        return this._body;
    }

    get error(){
        return this._error;
    }
}

/////////////////////////
///////Transaction
/////////////////////////
export class Transaction {
    constructor(){

    }
}

/////////////////////////
///////Publisher
/////////////////////////
export class Publisher {
    //Default Constructor
    constructor(){}

    //Get Name
    get name(){
        return this.constructor.name;
    }
}

/////////////////////////
///////Subscriber
/////////////////////////
export class Subscriber {
    public name: string;

    //Default Constructor
    constructor(name: string){
        this.name = name;
    }
}

/////////////////////////
///////Alias - Holds subscribers.
/////////////////////////
export class Alias {
    public name: string;

    //Default Constructor
    constructor(name?: string){
        this.name = name;
    }
}