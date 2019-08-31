//Local Imports
import ComPublisher from "./com.publisher";

export default class ComUtility{
    public static convertToPath(className: typeof ComPublisher, functionName: string){
        const publisherName = className.constructor.name.replace('Publisher', '');
        const path = ('/' + publisherName + '/' + functionName);
        return path;
    }

    public static convertToFunction(path: string){
        const topicLevels = path.split('/');

        let className = topicLevels[1];
        let functionName = topicLevels[2];
        return {className, functionName};
    }
}