//Import modules
import Promise from 'bluebird';
import { EventEmitter } from 'events';

//Local Imports
import { Client, Events } from './microservice';
import CommNode from './comm.node';

export default class CommMesh extends EventEmitter implements Client {
    //Mesh Variables.
    public readonly name: string;

    //Nodes
    private readonly nodes: Array<CommNode>;

    //Default Constructor
    constructor(){
        //Call super for EventEmitter.
        super();

        //Init Mesh variables.
        this.name = global.service.name;

        //Init variables.
        this.nodes = new Array();
    }

    /////////////////////////
    ///////Map Functions
    /////////////////////////
    public hasNode(){
        return (this.nodes.length > 0);
    }

    public getNodeAlias(url: string){
        //Try finding nodes.
        let node = this.nodes.find(node => node.url === url);

        if(!node){
            //No node found. creating a new node.
            node = this.createNode(url);
        }

        return node.alias;
    }
    
    private createNode(url: string){
        //Creating node object.
        const node = new CommNode(this.name, url);

        node.once(Events.NODE_CONNECTED, (node) => {
            this.emit(Events.NODE_CONNECTED, node);
        });

        node.once(Events.NODE_DISCONNECTED, (node) => {
            this.emit(Events.NODE_DISCONNECTED, node);
        });

        //Add to Array
        this.nodes.push(node);

        return node;
    }

    /////////////////////////
    ///////Connection Management
    /////////////////////////
    public connect(){
        return new Promise<boolean>((resolve, reject) => {
            this.emit(Events.MESH_CONNECTING);

            Promise.map(this.nodes, (node) => {
                return node.connect();
            }).then(() => {
                this.emit(Events.MESH_CONNECTED, this);
                resolve(true);
            }).catch((error) => {
                reject(error);
            });
        })
    }

    public disconnect(){
        return new Promise<boolean>((resolve, reject) => {
            this.emit(Events.MESH_DISCONNECTING);

            Promise.map(this.nodes, (node) => {
                return node.disconnect();
            }).then(() => {
                this.emit(Events.MESH_DISCONNECTED, this);
                resolve(true);
            }).catch((error) => {
                reject(error);
            });
        });
    }

    /////////////////////////
    ///////Report
    /////////////////////////
    public getReport(){
        let nodes = new Array();

        this.nodes.forEach(node => {
            nodes.push(node.getReport());
        });

        return nodes;
    }
}