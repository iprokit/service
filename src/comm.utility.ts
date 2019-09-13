export default class CommUtility {
    public static convertToTopic(className: string, functionName: string){
        const topic = ('/' + className + '/' + functionName);
        return topic;
    }

    public static convertToFunction(topic: string){
        const topicLevels = topic.split('/');

        let className = topicLevels[1];
        let functionName = topicLevels[2];

        if(className || functionName){
            return {className, functionName};
        }else{
            return undefined;
        }
    }
}