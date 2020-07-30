//Import modules
import { Request, Response } from 'express';

//Local Imports
import Service from './service';
import HttpStatusCodes from './http.statusCodes';

/**
 * The `ServiceRoutes` contains the default endpoints.
 * - Health: Endpoint to return the health status of the service.
 * - Report: Endpoint to return the report of the service.
 */
export default class ServiceRoutes {
    /**
     * The service instance.
     */
    public readonly service: Service;

    /**
     * Creates an instance of a `ServiceRoutes`.
     * 
     * @param service the service instance.
     */
    constructor(service: Service) {
        //Initialize variables.
        this.service = service;
    }

    //////////////////////////////
    //////Endpoints
    //////////////////////////////
    /**
     * Endpoint to return the health status of the service. The health status includes the following:
     * - The basic service configuration.
     * - The status of all the components.
     */
    public getHealth(request: Request, response: Response) {
        try {
            let healthy: boolean = true;
            let httpServer: boolean;
            let scpServer: boolean;
            let discovery: boolean;
            let serviceRegistry: boolean;
            let dbManager: boolean;

            if (this.service.httpServer) {
                httpServer = this.service.httpServer.listening;
                healthy = healthy && httpServer;
            }

            if (this.service.scpServer) {
                scpServer = this.service.scpServer.listening;
                healthy = healthy && scpServer;
            }

            if (this.service.discovery) {
                discovery = this.service.discovery.listening;
                healthy = healthy && discovery;
            }

            if (this.service.serviceRegistry.connected !== undefined) {
                serviceRegistry = this.service.serviceRegistry.connected;
                healthy = healthy && serviceRegistry;
            }

            if (this.service.dbManager) {
                dbManager = this.service.dbManager.connected;
                healthy = healthy && dbManager;
            }

            const code = (healthy === true) ? HttpStatusCodes.OK : HttpStatusCodes.INTERNAL_SERVER_ERROR;
            const health = {
                name: this.service.name,
                version: this.service.version,
                httpServer: httpServer,
                scpServer: scpServer,
                discovery: discovery,
                serviceRegistry: serviceRegistry,
                db: dbManager,
                healthy: healthy
            }

            response.status(code).send(health);
        } catch (error) {
            response.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send(error.message);
        }
    }

    /**
     * Endpoint to return the report of the service. The report includes the following:
     * - Service: The service configuration.
     * - DB: The `DBManager` connection configuration and `Model`'s loaded.
     * - Endpoints: The `HTTP` `Endpoint`'s exposed.
     * - Actions: The `SCP` `Action`'s exposed.
     * - Mesh: The `SCP` `Action`'s that can be called on each `Node` mounted on `Mesh`.
     * - ServiceRegistry: The `RemoteService`'s registed.
     */
    public getReport(request: Request, response: Response) {
        try {
            const report = {
                service: this.serviceReport,
                db: this.service.dbManager && this.dbReport,
                endpoints: this.endpointsReport,
                actions: this.actionsReport,
                mesh: this.meshReport,
                serviceRegistry: this.serviceRegistryReport
            }

            response.status(HttpStatusCodes.OK).send(report);
        } catch (error) {
            response.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send(error.message);
        }
    }

    /**
     * Endpoint to synchronize the database.
     */
    public async syncDatabase(request: Request, response: Response) {
        try {
            const sync = await this.service.dbManager.sync(request.body.force);
            response.status(HttpStatusCodes.OK).send({ sync: sync, message: 'Database & tables synced!' });
        } catch (error) {
            response.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).send(error.message);
        }
    }

    //////////////////////////////
    //////Reports
    //////////////////////////////
    /**
     * The Service configuration.
     */
    public get serviceReport() {
        return {
            name: this.service.name,
            version: this.service.version,
            environment: this.service.environment,
            httpPort: this.service.httpPort,
            scpPort: this.service.scpPort,
            discoveryPort: this.service.discoveryPort,
            discoveryIp: this.service.discoveryIp,
            ip: this.service.ip,
            logPath: this.service.logPath,
            identifiers: {
                scp: this.service.scpServer.identifier,
                discovery: this.service.discovery.id
            }
        }
    }

    /**
     * The `DBManager` connection configuration and `Model`'s loaded.
     */
    private get dbReport() {
        let models: { [name: string]: string } = {};

        //Gets models.
        if (this.service.dbManager.noSQL) {
            (this.service.dbManager.models).forEach(model => {
                models[model.name] = model.collection.name;
            });
        }
        if (this.service.dbManager.rdb) {
            this.service.dbManager.models.forEach(model => {
                models[model.name] = model.tableName;
            });
        }

        return {
            name: this.service.dbManager.name,
            host: this.service.dbManager.host,
            type: this.service.dbManager.type,
            connected: this.service.dbManager.connected,
            models: models
        }
    }

    /**
     * The `HTTP` `Endpoint`'s exposed.
     */
    private get endpointsReport() {
        const appRoutes: Array<{ fn: string, [method: string]: string }> = new Array();
        const httpRoutes: { [route: string]: Array<{ fn: string, [method: string]: string }> } = {};

        //Push app middlewares to `appRoutes`.
        this.service.express._router.stack.forEach((stack: any) => {
            if (stack.route) {
                const route = this.getHandlerInfo(stack);
                this.isApiRoute(route.method) && appRoutes.push({ fn: route.fn, [route.method]: route.path });
            }
        });

        //Push router middlewares to `httpRoutes`.
        this.service.routes.forEach(route => {
            const routes = new Array();
            const mountPath = (route.path === '/') ? '' : route.path;

            //Get router handlers.
            route.router.stack.forEach(stack => {
                if (stack.route) {
                    const route = this.getHandlerInfo(stack);
                    this.isApiRoute(route.method) && routes.push({ fn: route.fn, [route.method]: `${mountPath}${route.path}` });
                }
            });

            httpRoutes[route.path.toString()] = routes;
        });

        //Merge Routes.
        if (httpRoutes['/']) {
            httpRoutes['/'].push(...appRoutes);
        } else if (httpRoutes['/'] && appRoutes.length > 0) {
            httpRoutes['/'] = appRoutes;
        }

        return httpRoutes;
    }

    /**
     * The `SCP` `Action`'s exposed.
     */
    private get actionsReport() {
        const scpRoutes: { [action: string]: string } = {};

        //Get SCP Routes.
        this.service.scpServer.routes.forEach(route => {
            scpRoutes[route.map] = route.type;
        });

        return scpRoutes;
    }

    /**
     * The `SCP` `Action`'s that can be called on each `Node` mounted on `Mesh`.
     */
    private get meshReport() {
        const mesh: { [traceName: string]: { broadcasts: Array<string>, replies: Array<string> } } = {};

        Object.entries(this.service.scpClientManager.mesh).forEach(([traceName, node]) => {
            mesh[traceName] = {
                broadcasts: node.broadcasts,
                replies: node.replies
            }
        });

        return mesh;
    }

    /**
     * The `RemoteService`'s registed.
     */
    private get serviceRegistryReport() {
        return this.service.serviceRegistry.map(remoteService => {
            return {
                name: remoteService.name,
                alias: remoteService.alias,
                defined: remoteService.defined,
                address: remoteService.address,
                httpPort: remoteService.httpPort,
                scpPort: remoteService.scpPort,
                scpClient: {
                    client: remoteService.scpClient.identifier,
                    remote: remoteService.scpClient.node.identifier,
                    connected: remoteService.scpClient.connected,
                    reconnecting: remoteService.scpClient.reconnecting,
                },
                proxyClient: {
                    linked: remoteService.proxyClient.linked
                }
            }
        });
    }

    //////////////////////////////
    //////Helpers
    //////////////////////////////
    /**
     * Validates if the HTTP verbose is a valid API method.
     * 
     * @param method the name of the HTTP verbose.
     */
    private isApiRoute(method: string) {
        return method === 'GET' || method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'ALL';
    }

    /**
     * Gets and returns the handler information.
     * 
     * @param handler the router/application handler.
     */
    private getHandlerInfo(handler: any) {
        const method = Object.keys(handler.route.methods)[0];
        const name = (handler.route.stack.length > 1) ? '<multiple>' : handler.route.stack[0].name;

        return {
            fn: (name === '') ? '<anonymous>' : name,
            method: (method === '_all') ? 'ALL' : method.toUpperCase(),
            path: handler.route.path
        }
    }
}