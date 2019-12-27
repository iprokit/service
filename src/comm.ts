export declare type Topic = string;

export declare type TopicExp = {
    topic: string;
    baseTopic: string;
    id: string;
    action: string;
}

/////////////////////////
///////Interfaces
/////////////////////////
export interface IMessage {}

export interface IReply {
    isError: boolean;
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