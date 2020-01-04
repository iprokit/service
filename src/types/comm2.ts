//Types
export type Topic = string;
export type MessageParms = Object;
export type ReplyBody = Object;
export type ReplyError = Object;

/////////////////////////
///////Comm
/////////////////////////
export interface Comm {
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
    protected _parms: MessageParms;

    constructor(topic: Topic, parms: MessageParms){
        this.topic = topic;
        this._parms = parms;
    }

    public get parms(){
        return this._parms;
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

    public get body(){
        return this._body;
    }

    public get error(){
        return this._error;
    }
}

/////////////////////////
///////ReplyTransaction
/////////////////////////
export class ReplyTransaction {
    constructor(){

    }
}

/////////////////////////
///////TopicHelper
/////////////////////////
export class TopicHelper {
    private topic: string;

    constructor(topic: string){
        this.topic = topic;
    }

    public get className(){
        return this.topic.split('/')[1];
    }

    public get functionName(){
        return this.topic.split('/')[2];
    }

    public get transaction(){
        return {commit: this.topic + '/commit', rollback: this.topic + '/rollback'};
    }

    public isTransactionTopic(){
        return (this.topic.endsWith('/commit') || this.topic.endsWith('/rollback'));
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