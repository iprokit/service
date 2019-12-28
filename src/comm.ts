export declare type Topic = string;

/**
 * @param topic the original given topic.
 * @param routingTopic the class/function.
 * @param class index [0] of stack.
 * @param function index [1] of stack.
 * @param id index [2] of stack.
 * @param action index [3] of stack.
 * @param stack split of the topic. Contains 0-N
 */
export declare type TopicExp = {
    topic: string;
    routingTopic: string;
    class: string;
    function: string;
    id: string;
    action: string;
    stack: Array<string>;
}

///////Body
export type Body = any;

///////Message/Reply
export interface IMessage extends Body {}

export interface IReply extends Body{
    isError: boolean;
}

///////Broadcast
export interface IBroadcast extends Body {}

///////Handshake
export interface Handshake extends IBroadcast {
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