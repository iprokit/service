export declare type Topic = string;

export declare type Method = 'reply' | 'broadcast' | 'transaction';
export declare type Action = 'prepare' | 'commit' | 'rollback';

///////Topic
export interface ITopicExp {
    method: Method;
    class: string;
    function: string;
    id: string;
    action: Action;
    stack: Array<string>;
    topic: Topic;
    routingTopic: string;
}

export class TopicExp implements ITopicExp {
    public readonly method: Method;
    public readonly class: string;
    public readonly function: string;
    public readonly id: string;
    public readonly action: Action;
    public readonly stack: string[];

    public readonly topic: Topic;
    public readonly routingTopic: string;

    constructor(topic: Topic){
        const stack = topic.split('/');

        this.method = this.validateAndGetMethod(stack[0] as Method);
        this.class = stack[1];
        this.function = stack[2];
        this.id = stack[3];
        this.action = this.validateAndGetAction(stack[4] as Action);
        this.stack = stack;

        this.topic = topic;
        this.routingTopic = stack[1] + '/' + stack[2];
    }

    private validateAndGetMethod(method: Method){
        switch(method){
            case 'reply': 
                return 'reply';
            case 'transaction': 
                return 'transaction';
            default:
                return;
        }
    }

    private validateAndGetAction(action: Action){
        switch(action){
            case 'prepare': 
                return 'prepare';
            case 'commit': 
                return 'commit';
            case 'rollback': 
                return 'rollback';
            default:
                return;
        }
    }
}

export class BroadcastTopicExp implements ITopicExp {
    public readonly method: Method;
    public readonly class: string;
    public readonly function: string;
    public readonly id: string;
    public readonly action: Action;
    public readonly stack: string[];

    public readonly topic: Topic;
    public readonly routingTopic: string;

    constructor(topic: Topic){
        this.method = 'broadcast';
        this.class = topic;

        this.topic = this.method + '/' + topic;
        this.routingTopic = topic;
    }
}

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
export type HandshakeRoute = {
    method: Method,
    topic: Topic
}
export interface Handshake extends IBroadcast {
    name: string;
    messageReplys: Array<HandshakeRoute>;
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