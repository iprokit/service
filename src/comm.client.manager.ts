//Local Imports
import CommClient from './comm.client';

var commClients: Array<{name: string, client: CommClient}> = new Array<{name: string, client: CommClient}>();

//Types: CommClientManagerInitOptions
export type CommClientManagerInitOptions = {
    services: Array<string>
}

export function getService(serviceName: string){
    const commClientsObject = commClients.find(client => client.name === serviceName);
    return commClientsObject.client;
}

export default class CommClientManager {
    //Default Constructor
    constructor(){
        //Do nothing
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public init(initOptions: CommClientManagerInitOptions){
        //Load init options.
        let services = initOptions.services || [];

        //Load Clients
        this.createCommClients(services);
    }

    /////////////////////////
    ///////Map Functions
    /////////////////////////
    private createCommClients(ips: Array<string>){
        ips.forEach(ip => {
            //Creating comm client object.
            const commClient = new CommClient(ip);

            //Add to Array
            commClients.push({name: ip, client: commClient});
        });
    }

    /////////////////////////
    ///////Start/Stop Functions
    /////////////////////////
    public connect(){
        return new Promise((resolve, reject) => {
            let urls = new Array();
            commClients.forEach((commClient) => {
                //Connect to comm client
                commClient.client.connect()
                    .then((url) => {
                        urls.push(url);
                    })
                    .finally(() => {
                        resolve(urls);
                    })
            });
        });
    }

    public disconnect(){
        return new Promise((resolve, reject) => {
            //Close Comm Client connections.
            commClients.forEach((commClient) => {
                const _commClient = commClient.client;
                _commClient.disconnect()
                    .finally(() => {
                        resolve();
                    });
            });
        });
    }
}