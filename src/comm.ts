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
export interface Broadcast {
    name: string;
    messageReplys: Array<Topic>;
    actions: Array<Topic>;
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