//Import modules
import { Request, Response } from 'express';
import httpStatus from 'http-status-codes';

//Local Imports
import CommClient from './comm.client';
import { Report } from './routes';

//Types: CommMeshInitOptions
export type CommMeshInitOptions = {
    mesh: Array<string>
}

export function getService(name: string){
    const commClientObject = that.commClients.find(client => client.name === name);
    if(commClientObject !== undefined){
        return commClientObject.client;
    }else{
        throw new Error('Invalid service. Service not defined as mesh at entry point.');
    }
}

//Alternative for this.
var that: CommMesh;

export default class CommMesh {
    //Clients
    public readonly commClients: Array<{name: string, client: CommClient}> = new Array<{name: string, client: CommClient}>();

    //Default Constructor
    constructor(){
        //Setting that as this.
        that = this;

        //Auto call, to create mesh endpoints.
        new CommMeshController();
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
            this.commClients.push({name: host, client: commClient});
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
            this.commClients.forEach((commClient) => {
                const _commClient = commClient.client;
                _commClient.disconnect()
                    .finally(() => {
                        resolve();
                    });
            });
        });
    }
}

/////////////////////////
///////CommMesh Controller
/////////////////////////
class CommMeshController {
    @Report('/comm/mesh/report')
    public getReport(request: Request, response: Response){
        try {
            let clients = new Array<{host: string, broadcastTopic: string, connected: boolean, topics: Array<string>}>();
            that.commClients.forEach((client) => {
                let commClient = client.client;
                clients.push({
                    host: commClient.host,
                    broadcastTopic: commClient.broadcastTopic,
                    connected: commClient.isConnected(),
                    topics: commClient.getTopics()
                });
            });

            response.status(httpStatus.OK).send({status: true, data: clients});
        } catch (error) {
            response.status(httpStatus.INTERNAL_SERVER_ERROR).send({status: false, message: error.message});
        }
    }
}