export declare type Topic = string;

/////////////////////////
///////On Action
/////////////////////////
export declare type Action = EventAction | BroadcastAction;

export declare type ActionType = Event | Broadcast;

/////////////////////////
///////Comm
/////////////////////////
export interface Comm<M extends IMessage, R extends IReply> {
    clientId: string;
    commId: string;
    topic: Topic;
    message: M;
    reply: R
}

/////////////////////////
///////Basic 
/////////////////////////
export interface IMessage { 
    id: string;
}

export interface IReply {
    id: string;
}

export interface IAction {
    name: string;
}

/////////////////////////
///////Message/Reply
/////////////////////////
export interface Message extends IMessage {
    id: string;
    parms: any;
}

export interface Reply extends IReply {
    id: string;
    body: any;
    error: boolean;
}

/////////////////////////
///////Event
/////////////////////////
export declare type EventAction = 'event';

export interface Event extends IAction {
    action: any;
}

/////////////////////////
///////Broadcast
/////////////////////////
export declare type BroadcastAction = 'broadcast';

export interface BroadcastMap {
    topic: Topic;
}

export interface Broadcast extends IAction{
    map: Array<BroadcastMap>;
}

/////////////////////////
///////Transaction
/////////////////////////
// export declare type TransactionMethod = 'transaction';
// export declare type TransactionOptions = 'prepare' | 'commit' | 'rollback';

// export interface TransactionMessage extends Message {
//     commit?: boolean;
//     rollback?: boolean;
// }

// export interface TransactionReply extends Reply {
//     committed?: boolean;
//     rolledback?: boolean;
// }

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