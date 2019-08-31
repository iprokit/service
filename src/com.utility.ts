//Local Imports
import ComPublisher from "./com.publisher";

export default class ComUtility{
    public static convertToTopic(className: typeof ComPublisher, functionName: string){
        const publisherName = className.constructor.name.replace('Publisher', '');
        const topic = ('/' + publisherName + '/' + functionName);
        return topic;
    }

    public static convertToFunction(topic: string){
        const topicLevels = topic.split('/');

        let className = topicLevels[1];
        let functionName = topicLevels[2];
        return {className, functionName};
    }
}