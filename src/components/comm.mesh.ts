//Import modules
import EventEmitter from 'events';

import CommClient from './comm.client';

export default class CommMesh extends EventEmitter {
    //Mesh Variables.
    public readonly name: string;

    //Nodes
    private readonly clients: Array<CommClient>;

    //Default Constructor
    constructor(){
        //Call super for EventEmitter.
        super();

        //Init Mesh variables.
        this.name = global.service.name;

        //Init variables.
        this.clients = new Array();
    }

    /////////////////////////
    ///////Map Functions
    /////////////////////////
    public hasNode(){
        return (this.clients.length > 0);
    }

    private createNode(url: string, identifier: string){
        //Creating node object.
        const client = new CommClient(this.name, url, identifier);

        //Add to Array
        this.clients.push(client);

        //Emit node added.
        this.emit('', client);

        return client;
    }
    
    public defineNode(url: string, identifier: string){
        this.createNode(url, identifier);
    }

    public getAlias(identifier: string){
        //Try finding node.
        return this.clients.find(node => node.identifier === identifier).alias;
    }

    public async defineNodeAndGetAlias(url: string){
        //Try finding nodes.
        let node = this.clients.find(node => node.url === url);

        if(!node){
            //No node found. creating a new node.
            node = this.createNode(url, url);
        }

        //This is a new node it has to be connected.
        if(!node.connected && !node.reconnecting){
            await node.connect();
        }

        return node.alias;
    }

    /////////////////////////
    ///////Connection Management
    /////////////////////////
    public async connect() {
        if(this.hasNode()){
            this.emit('');

            try{
                await Promise.all(this.clients.map(node => node.connect()));
                this.emit('', this);
                return 1;
            }catch(error){
                throw error;
            }
        }
        return -1;
    }

    public async disconnect(){
        if(this.hasNode()){
            this.emit('');

            try{
                await Promise.all(this.clients.map(node => node.disconnect()));
                this.emit('', this);
                return 0;
            }catch(error){
                throw error;
            }
        }
        return -1;
    }
    /////////////////////////
    ///////Report
    /////////////////////////
    public getReport(){
        let nodes = new Array();

        this.clients.forEach(node => {
            nodes.push(node.getReport());
        });

        return nodes;
    }
}