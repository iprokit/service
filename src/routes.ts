//Import modules
import { PathParams } from 'express-serve-static-core';

//Local Import
import { Endpoint } from './app';
import Controller from './controller';

export default class Routes {
    public baseURL: PathParams;
    private controller: Controller;

    public constructor(controller: Controller){
        this.controller = controller;
        
        const name = this.constructor.name.replace('Routes', '');
        this.baseURL = '/' + name.toLowerCase();
    }

    /////////////////////////
    ///////Map Endpoints
    /////////////////////////
    public mapDefaultEndpoints(): Array<Endpoint>{
        return [
            {method: 'get', url: '/:id', fn: this.controller.getOneByID},
            {method: 'get', url: '/', fn: this.controller.getAll},
            {method: 'get', url: '/orderby/:orderType', fn: this.controller.getAllOrderByCreatedAt},
            {method: 'post', url: '/', fn: this.controller.create},
            {method: 'put', url: '/', fn: this.controller.updateOneByID},
            {method: 'delete', url: '/:id', fn: this.controller.deleteOneByID}
        ]
    }

    public mapCustomEndpoints(): Array<Endpoint>{
        return;
    }
}