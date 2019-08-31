//Import modules
import mosca from 'mosca';

//Local Imports
import ComRouter from './com.router';

export default class ComBroker {
    private comRouter: ComRouter;
    private mosca: mosca.Server;

    //Default Constructor
    constructor(){
        //Do nothing
    }

    public use(comRouter: ComRouter){
        this.comRouter = comRouter;
    }

    /////////////////////////
    ///////Start/Stop Functions
    /////////////////////////
    public listen(port: number | string, fn: Function){
        const options = {
            id: global.service.name,
            port: port
        }
        
        this.mosca = new mosca.Server(options);

        this.mosca.on('ready', () => {
            fn();
        });

        this.mosca.on('published', (packet, client) => {
            var topic = packet.topic;
            if (!topic.includes('$SYS/')) { //Ignoring all default $SYS/ topics.
                var payload = packet.payload.toString();
                console.log('%s published a message: %o on topic: %s', client.id, payload, topic)
            }
        });
    }

    public stop(fn: Function){
        this.mosca.close(() => {
            fn();
        });
    }
}