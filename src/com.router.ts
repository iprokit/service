//Import modules
import Events from 'events';

//Interface: Message
interface Message {
    body: string;
}

//Interface: Reply
interface Reply {
    body: PublishHandlerReply;
}

//Interface: PublishHandlerReply
interface PublishHandlerReply {}

//Types: PublishHandler
type PublishHandler = (message: Message) => PublishHandlerReply;

export default class ComRouter {
    private publishHandlers = new Array<{path: string, handler: PublishHandler}>();

    //Default Constructor
    constructor(){
    }

    public onMessage(path: string, message: Message){
        this.publishHandlers.forEach(publishHandler => {
            if(path === publishHandler.path){
                const publishHandlerReply = publishHandler.handler(message);
                //this.sendReply(path, {body: publishHandlerReply});
            }
        });
    }

    public publish(path: string, handler: PublishHandler){
        if(this.publishHandlers.indexOf({path, handler}) === -1){
            this.publishHandlers.push({path, handler});
        }
    }
}

/////////////////////////
///////Message Emitter
/////////////////////////
class MessageEmitter extends Events {}