///////Topic
export declare type Topic = string;

///////Body
export type Body = any;

export interface ErrorBody extends Body {
    message: any,
    isError: boolean
}

///////Message/Reply
export interface IMessage extends Body {}

export interface IReply extends Body {
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