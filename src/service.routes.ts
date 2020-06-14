//Import modules
import { Request, Response } from 'express';
import HttpCodes from 'http-status-codes';

//Local Imports
import Service from './service';

/**
 * The `ServiceRoutes` contains the service default endpoints.
 * - Health: Endpoint to return the health status of the service.
 * - Report: Endpoint to return the report of the service.
 * - Shutdown: Endpoint to safely shutdown the service.
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
     * - The status of the `HttpServer` + `ScpServer`.
     */
    public getHealth(request: Request, response: Response) {
        try {
            const health = {
                name: this.service.name,
                version: this.service.version,
                healthy: (this.service.httpServer.listening && this.service.scpServer.listening)
            }
            response.status(HttpCodes.OK).send(health);
        } catch (error) {
            response.status(HttpCodes.INTERNAL_SERVER_ERROR).send(error.message);
        }
    }

    /**
     * Endpoint to return the report of the service. The report includes the following:
     * - Service: The service configuration.
     * - System: The CPU and Memory usage of the service.
     * - DB: The `DBManager` connection configuration and `Model`'s loaded.
     * - Endpoints: The `HTTP` `Endpoint`'s exposed.
     * - Actions: The `SCP` `Action`'s exposed.
     * - Mesh: The `SCP` `Action`'s that can be called on each `Node` mounted on `Mesh`.
     * - RemoteServices: The remote services discovered.
     */
    public getReport(request: Request, response: Response) {
        try {
            const report = {
                service: this.serviceReport,
                system: this.systemReport,
                db: this.service.dbManager.connection && this.dbReport,
                endpoints: this.endpointsReport,
                actions: this.actionsReport,
                mesh: this.meshReport,
                remoteServices: this.remoteServicesReport
            }

            response.status(HttpCodes.OK).send(report);
        } catch (error) {
            response.status(HttpCodes.INTERNAL_SERVER_ERROR).send(error.message);
        }
    }

    /**
     * Endpoint to safely shutdown the service. Shutdown will be initiated after 2 seconds.
     */
    public shutdown(request: Request, response: Response) {
        response.status(HttpCodes.OK).send({ message: 'Will shutdown in 2 seconds...' });

        setTimeout(() => {
            this.service.logger.info(`Received shutdown from ${request.url}`);
            process.kill(process.pid, 'SIGTERM');
        }, 2000);
    }

    /**
     * Endpoint to synchronize the database.
     */
    public async syncDatabase(request: Request, response: Response) {
        try {
            const sync = await this.service.dbManager.sync(request.body.force);
            response.status(HttpCodes.OK).send({ sync: sync, message: 'Database & tables synced!' });
        } catch (error) {
            response.status(HttpCodes.INTERNAL_SERVER_ERROR).send(error.message);
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
     * The CPU and Memory usage of the service.
     */
    private get systemReport() {
        let memoryUsage: { [key: string]: string } = {};

        Object.entries(process.memoryUsage()).forEach(([key, value]) => {
            memoryUsage[key] = `${Math.round(value / 1024 / 1024 * 100) / 100}MB`;
        });

        const cpuUsage = process.cpuUsage();

        return {
            pid: process.pid,
            cpu: {
                system: cpuUsage.system,
                user: cpuUsage.user
            },
            memory: memoryUsage
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
        } else {
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
        const httpRoutes: { [route: string]: Array<{ fn: string, [method: string]: string }> } = {};
        const appRoutes: Array<{ fn: string, [method: string]: string }> = new Array();

        /**
         * Get array of middlewares from express.
         * - Push app middlewares to `appRoutes`.
         * - Push router middlewares to `httpRoutes`.
         */
        this.service.express._router.stack.forEach((middleware: any) => {
            if (middleware.route) {
                const route = this.getHandlerInfo(middleware);
                this.isApiRoute(route.method) && appRoutes.push({ fn: route.fn, [route.method]: route.path });
            } else if (middleware.name === 'router') {
                const routes = new Array();
                const mountPath = (middleware.handle.mountPath === '/') ? '' : middleware.handle.mountPath;

                //Get router handlers.
                middleware.handle.stack.forEach((handler: any) => {
                    if (handler.route) {
                        const route = this.getHandlerInfo(handler);
                        this.isApiRoute(route.method) && routes.push({ fn: route.fn, [route.method]: `${mountPath}${route.path}` });
                    }
                });

                httpRoutes[middleware.handle.mountPath] = routes;
            }
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

        Object.entries(this.service.mesh).forEach(([traceName, node]) => {
            mesh[traceName] = {
                broadcasts: node.broadcasts,
                replies: node.replies
            }
        });

        return mesh;
    }

    /**
     * The remote services discovered.
     */
    private get remoteServicesReport() {
        return Object.entries(this.service.remoteServices).map(([name, remoteService]) => {
            return {
                name: remoteService.name,
                alias: remoteService.alias,
                address: remoteService.address,
                httpPort: remoteService.httpPort,
                scpPort: remoteService.scpPort,
                scpClient: {
                    client: remoteService.scpClient.identifier,
                    remote: remoteService.scpClient.node.identifier,
                    connected: remoteService.scpClient.connected,
                    reconnecting: remoteService.scpClient.reconnecting,
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
        return method === 'GET' || method === 'POST' || method === 'PUT' || method === 'DELETE' || method === undefined;
    }

    /**
     * Gets and returns the handler information.
     * 
     * @param handler the router/application handler.
     */
    private getHandlerInfo(handler: any) {
        const stack = handler.route.stack[0];

        return {
            fn: (stack.name === '') ? '<anonymous>' : stack.name.replace('bound ', ''),
            method: (stack.method === undefined) ? 'all' : stack.method.toUpperCase(),
            path: handler.route.path
        }
    }
}