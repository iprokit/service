//Local Imports
import { Component } from './microservice';
import CommClient from './comm.client';

//Types: CommMeshInitOptions
export type CommMeshInitOptions = {
    mesh: Array<string>
}

export function getService(name: string){
    const commClientObject = commClients.find(client => client.host === name);
    if(commClientObject !== undefined){
        return commClientObject.client.getService();
    }else{
        throw new Error('Invalid service. Service not defined as mesh at entry point.');
    }
}

//Clients
var commClients: Array<{host: string, client: CommClient}> = new Array<{host: string, client: CommClient}>();

export default class CommMesh implements Component {
    //Options
    private initOptions: CommMeshInitOptions;

    //Default Constructor
    constructor(){}

    /////////////////////////
    ///////Gets/Sets
    /////////////////////////
    public getOptions() {
        return {initOptions: this.initOptions};
    }

    public getReport() {
        let clients = new Array();

        commClients.forEach((client) => {
            clients.push(client.client.getReport());
        });

        const report = {
            clients: clients
        };
        return report;
    }

    /////////////////////////
    ///////init Functions
    /////////////////////////
    public init(initOptions: CommMeshInitOptions){
        //Load init options.
        this.initOptions = initOptions;
        this.initOptions.mesh = initOptions.mesh || [];

        //Load Clients
        this.createCommClients(this.initOptions.mesh);
    }

    /////////////////////////
    ///////Map Functions
    /////////////////////////
    private createCommClients(hosts: Array<string>){
        hosts.forEach(host => {
            //Creating comm client object.
            const commClient = new CommClient(host);

            //Add to Array
            commClients.push({host: host, client: commClient});
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
            if(commClients.length === 0){
                resolve();
            }else{
                commClients.forEach((commClient) => {
                    const _commClient = commClient.client;
                    _commClient.disconnect()
                        .finally(() => {
                            resolve();
                        });
                });
            }
        });
    }
}