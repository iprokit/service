//Local Imports
import CommClient from './comm.client';

var commClients: Array<{name: string, client: CommClient}> = new Array<{name: string, client: CommClient}>();

//Types: CommMeshInitOptions
export type CommMeshInitOptions = {
    mesh: Array<string>
}

export function getService(name: string){
    const commClientObject = commClients.find(client => client.name === name);
    if(commClientObject !== undefined){
        return commClientObject.client;
    }else{
        throw new Error('Invalid service. Service not defined as mesh at entry point.');
    }
}

export default class CommMesh {
    //Default Constructor
    constructor(){
        //Do nothing
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public init(initOptions: CommMeshInitOptions){
        //Load init options.
        let hosts = initOptions.mesh || [];

        //Load Clients
        this.createCommClients(hosts);
    }

    /////////////////////////
    ///////Map Functions
    /////////////////////////
    private createCommClients(hosts: Array<string>){
        hosts.forEach(host => {
            //Creating comm client object.
            const commClient = new CommClient(host);

            //Add to Array
            commClients.push({name: host, client: commClient});
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