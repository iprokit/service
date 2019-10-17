//Local Imports
import { Component } from './microservice';
import CommClient from './comm.client';

//Types: CommMeshInitOptions
export type CommMeshInitOptions = {
    mesh: Array<string>
}

export function getService(name: string){
    const commClientObject = that.commClients.find(client => client.host === name);
    if(commClientObject !== undefined){
        return commClientObject.client.getService();
    }else{
        throw new Error('Invalid service. Service not defined as mesh at entry point.');
    }
}

//Alternative for this.
var that: CommMesh;

export default class CommMesh implements Component {
    //Options
    private initOptions: CommMeshInitOptions;

    //Clients
    public readonly commClients: Array<{host: string, client: CommClient}> = new Array<{host: string, client: CommClient}>();

    //Default Constructor
    constructor(){
        //Setting that as this.
        that = this;
    }

    /////////////////////////
    ///////Gets/Sets
    /////////////////////////
    public getOptions() {
        return {initOptions: this.initOptions};
    }

    public getReport() {
        let clients = new Array();

        this.commClients.forEach((client) => {
            let commClient = client.client;
            clients.push({
                host: commClient.getHost(),
                broadcastTopic: commClient.broadcastTopic,
                connected: commClient.isConnected(),
                disconnected: commClient.isDisconnected(),
                reconnecting: commClient.isReconnecting(),
                topics: commClient.getTopics()
            });
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
            this.commClients.push({host: host, client: commClient});
        });
    }

    /////////////////////////
    ///////Start/Stop Functions
    /////////////////////////
    public connect(){
        return new Promise((resolve, reject) => {
            let urls = new Array();
            this.commClients.forEach((commClient) => {
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
            if(this.commClients.length === 0){
                resolve();
            }else{
                this.commClients.forEach((commClient) => {
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