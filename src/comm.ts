export declare type Topic = string;

/////////////////////////
///////Interfaces
/////////////////////////
export interface Message {}

export interface Reply {
    error: boolean;
}

export interface Broadcast {}

/////////////////////////
///////Broadcast
/////////////////////////
export interface Handshake {
    name: string;
    messageReplys: Array<Topic>;
    broadcasts: Array<Topic>;
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