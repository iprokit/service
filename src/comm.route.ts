//Local Imports
import { commBroker } from './app';
import CommPublisher from './comm.publisher';
import CommUtility from './comm.utility';

/////////////////////////
///////Router Decorators
/////////////////////////
export function Publish() {
    return function (target: typeof CommPublisher, propertyKey: string, descriptor: PropertyDescriptor) {
        const path = CommUtility.convertToPath(target, propertyKey);
        commBroker.publish(path, descriptor.value);
    }
}