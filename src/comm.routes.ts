//Local Imports
import { commBroker } from './app';
import { PublishCallback } from './comm.broker';
import CommPublisher from './comm.publisher';
import CommUtility from './comm.utility';

//Interface: PublishFunctionDescriptor
interface PublishFunctionDescriptor extends PropertyDescriptor {
    value?: PublishCallback;
}

//Types: PublishFunction
export declare type PublishFunction = (target: typeof CommPublisher, propertyKey: string, descriptor: PublishFunctionDescriptor) => void;

/////////////////////////
///////Router Decorators
/////////////////////////
export function Publish(): PublishFunction {
    return function (target, propertyKey, descriptor) {
        const path = CommUtility.convertToPath(target, propertyKey);
        commBroker.publish(path, descriptor.value);
    }
}