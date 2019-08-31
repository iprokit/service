//Import modules
import mosca from 'mosca';

//Local Imports
import ComRouter from './com.router';

export default class ComBroker {
    private comRouter: ComRouter;
    private mosca: mosca.Server;

    //Default Constructor
    constructor(){
        this.comRouter = new ComRouter();
    }

    /////////////////////////
    ///////Gets/Sets
    /////////////////////////
    public get router() {
        return this.comRouter;
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
            const topic = packet.topic;
            if (!topic.includes('$SYS/')) { //Ignoring all default $SYS/ topics.
                const payload = JSON.parse(packet.payload.toString());
                //TODO: Need to check if this is a message from server or client.
                this.comRouter.onMessage(topic, payload.message);
            }
        });
    }

    public reply(path: any, reply: any){
        const message = {
            topic: path,
            payload: JSON.stringify({reply: reply}),
            qos: 0,
            retain: false
        };

        console.log('message', message);
            
        // moscaApp.publish(message, (object, packet) => {
        //     console.log('Server: published a message: %o ', message);
        // });
    }

    public stop(fn: Function){
        this.mosca.close(() => {
            fn();
        });
    }
}