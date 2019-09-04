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
        const path = CommUtility.convertToPath(target, propertyKey);
        commBroker.handleReply(path, descriptor.value);
    }
}