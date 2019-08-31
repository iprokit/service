//Local Imports
import { comRouter } from './app';
import ComUtility from './com.utility';

export default class ComPublisher {
    private getTopics(){

    }
}

/////////////////////////
///////Decorators
/////////////////////////
export function Publish() {
    return function (target: typeof ComPublisher, propertyKey: string, descriptor: PropertyDescriptor) {
        const path = ComUtility.convertToPath(target, propertyKey);
        comRouter.publish(path, descriptor.value);
    }
}