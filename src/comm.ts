export declare type Topic = string;

/////////////////////////
///////Message/Reply
/////////////////////////
export interface Message {
    id: string;
    parms: any;
}

export interface Reply {
    id: string;
    body: any;
    error: boolean;
}

/////////////////////////
///////Action
/////////////////////////
export interface Action {
    name: string;
    action: any;
}

/////////////////////////
///////Broadcast
/////////////////////////
export interface BroadcastMap {
    topic: Topic;
}

export interface Broadcast{
    name: string;
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