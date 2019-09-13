//Local Imports
import { commBroker } from './app';
import { ReplyCallback, Publisher } from './comm.broker';
import CommUtility from './comm.utility';

//Interface: ReplyFunctionDescriptor
interface ReplyFunctionDescriptor extends PropertyDescriptor {
    value?: ReplyCallback;
}

//Types: ReplyFunction
export declare type ReplyFunction = (target: typeof Publisher, propertyKey: string, descriptor: ReplyFunctionDescriptor) => void;

/////////////////////////
///////Router Decorators
/////////////////////////
export function Reply(): ReplyFunction {
    return function (target, propertyKey, descriptor) {
        const publisherName = target.constructor.name.replace('Publisher', '');
        const topic = CommUtility.convertToTopic(publisherName, propertyKey);
        commBroker.handleReply(topic, descriptor.value);
    }
}