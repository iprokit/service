//Import modules
import EventEmitter from 'events';

import { Events } from "../store/events";
import { IClient, ConnectionState } from "../types/component";
import CommClient from './client';

export default class CommMesh extends EventEmitter implements IClient {
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
        this.emit(Events.MESH_ADDED_NODE, client);

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
    public async connect(): Promise<ConnectionState> {
        if(this.hasNode()){
            this.emit(Events.MESH_CONNECTING);

            try{
                await Promise.all(this.clients.map(node => node.connect()));
                this.emit(Events.MESH_CONNECTED, this);
                return 1;
            }catch(error){
                throw error;
            }
        }
        return -1;
    }

    public async disconnect(): Promise<ConnectionState>{
        if(this.hasNode()){
            this.emit(Events.MESH_DISCONNECTING);

            try{
                await Promise.all(this.clients.map(node => node.disconnect()));
                this.emit(Events.MESH_DISCONNECTED, this);
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