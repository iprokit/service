//Local Imports
import { comBroker } from './app';
import ComUtility from './com.utility';

export default class ComPublisher {}

/////////////////////////
///////Decorators
/////////////////////////
export function Publish() {
    return function (target: typeof ComPublisher, propertyKey: string, descriptor: PropertyDescriptor) {
        const path = ComUtility.convertToPath(target, propertyKey);
        comBroker.publish(path, descriptor.value);
    }
}