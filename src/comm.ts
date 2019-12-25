//TODO: Add regular expression to this.
export declare type Topic = string;

/////////////////////////
///////Comm
/////////////////////////
export declare type Method = 'reply' | 'transaction' | 'event';

export interface IComm<M extends IMessage, R extends IReply>{
    commId: string;
    clientId: string;
    topic: Topic;
    method: Method;
    message: M;
    reply: R
}

export class Comm<M extends Message, R extends Reply> implements IComm<M, R>{
    commId: string;
    clientId: string;
    topic: Topic;
    method: Method;
    message: M;
    reply: R;
}

/////////////////////////
///////Basic Message/Reply
/////////////////////////
export declare type MessageType = Message | TransactionMessage;
export declare type ReplyType = Reply | TransactionReply | BroadcastReply | EventReply;

export interface IMessage {
    id: string;
}
export interface IReply {
    id: string;
}

/////////////////////////
///////Message/Reply
/////////////////////////
export class Message implements IMessage {
    id: string;
    parms: any;

    constructor(id: string, parms: any){
        this.id = id;
        this.parms = parms;
    }
}

export class Reply implements IReply {
    id: string;
    body: any;
    error: boolean;

    constructor(id: string, body?: any, error?: boolean){
        this.id = id;
        this.body = body;
        this.error = error === undefined ? false : error;
    }
}

/////////////////////////
///////Transaction
/////////////////////////
export class TransactionMessage extends Message implements IMessage {
    commit: boolean;
    rollback: boolean;

    constructor(id: string, parms: any){
        super(id, parms);
    }
}

export class TransactionReply extends Reply implements IReply {
    committed: boolean;
    rolledback: boolean;

    constructor(id: string, body: any, error?: boolean){
        super(id, body, error);
    }
}

/////////////////////////
///////Broadcast
/////////////////////////
export declare type BroadcastMap = {
    method: Method, topic: Topic
}
export class BroadcastReply implements IReply {
    id: string;
    name: string;
    map: Array<BroadcastMap>;

    constructor(name: string, map: Array<BroadcastMap>){
        this.name = name;
        this.map = map;
    }
}

/////////////////////////
///////Event
/////////////////////////
export class EventReply implements IReply {
    id: string;
    name: string;
    action: any;

    constructor(id: string, name: string, action: any){
        this.id = id;
        this.name = name;
        this.action = action;
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