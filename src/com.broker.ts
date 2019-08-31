//Import modules
import mosca from 'mosca';

//Local Imports
import ComRouter from './com.router';

export default class ComBroker {
    private router: ComRouter;
    private mosca: mosca.Server;

    //Default Constructor
    constructor(){
        //Do nothing
    }

    public use(router: ComRouter){
        this.router = router;
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
    }

    public stop(fn: Function){
        this.mosca.close(() => {
            fn();
        });
    }
}