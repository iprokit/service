//Import modules
import { Request, Response } from "express";
import HttpCodes from 'http-status-codes';
import { URL } from "url";

//Local Imports
import Service from "./service";

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
     * - The Service configuration.
     * - The status of the `HttpServer`.
     * - The status of the `ScpServer`.
     * - The status of the `Mesh`.
     * - The status of the `DBManager`.
     */
    public getHealth(request: Request, response: Response) {
        const health = {
            name: this.service.name,
            version: this.service.version,
            environment: this.service.environment,
            http: this.service.httpServer.listening,
            scp: this.service.scpServer.listening,
            mesh: this.service.scpClientManager.connected,
            db: this.service.dbManager.connected,
            healthy: (this.service.httpServer.listening && this.service.scpServer.listening)
        }
        response.status(HttpCodes.OK).send(health);
    }

    /**
     * Endpoint to return the report of the service. The report includes the following:
     * - Service: The Service configuration.
     * - System: The CPU and Memory usage of the service.
     * - DB: The `DBManager` connection configuration and `Model`'s loaded.
     * - Endpoints: The `HTTP` `Endpoint`'s exposed.
     * - Actions: The `SCP` `Action`'s exposed.
     * - Mesh: The `Mesh` object which includes `Node`'s. Each `Node` contains its configuration and the `Action`'s that can be called.
     */
    public getReport(request: Request, response: Response) {
        try {
            const report = {
                service: {
                    name: this.service.name,
                    version: this.service.version,
                    ip: this.service.ip,
                    httpPort: this.service.httpPort,
                    scpPort: this.service.scpPort,
                    environment: this.service.environment,
                    logPath: this.service.logPath
                },
                system: this.systemReport,
                db: this.service.dbManager.connection && this.dbReport,
                endpoints: this.endpointsReport,
                actions: this.actionsReport,
                mesh: this.meshReport
            }

            response.status(HttpCodes.OK).send(report);
        } catch (error) {
            response.status(HttpCodes.INTERNAL_SERVER_ERROR).send({ status: false, message: error.message });
        }
    }

    /**
     * Endpoint to safely shutdown the service. Shutdown will be initiated after 2 seconds.
     */
    public shutdown(request: Request, response: Response) {
        response.status(HttpCodes.OK).send({ status: true, message: 'Will shutdown in 2 seconds...' });
        setTimeout(() => {
            this.service.logger.info(`Received shutdown from ${request.url}`);
            process.kill(process.pid, 'SIGTERM');
        }, 2000);
    }

    //////////////////////////////
    //////Helpers
    //////////////////////////////
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

        //Get HTTP Routes.
        this.service.expressRouter.stack.forEach(item => {
            const stack = item.route.stack[0];

            //Create Variables.
            const path = String(item.route.path);
            const routeName = path.split('/').filter(Boolean)[0];
            const functionName = (stack.handle.name === '') ? '<anonymous>' : String(stack.handle.name).replace('bound ', '');
            const method = (stack.method === undefined) ? 'all' : String(stack.method).toUpperCase();

            /**
             * Note: Since handlers are called with bind() to pass the context, during the bind process its name is appended with `bound`.
             * This has to be replaced with empty string for the `functionName`.
             */

            //Try creating empty object.
            if (!httpRoutes[routeName]) {
                httpRoutes[routeName] = [];
            }

            //Add to object.
            httpRoutes[routeName].push({ fn: functionName, [method]: `${this.service.httpBaseUrl}${path}` });
        });

        return httpRoutes;
    }

    /**
     * The `SCP` `Action`'s exposed.
     */
    private get actionsReport() {
        const scpRoutes: { [action: string]: string } = {};

        //Get SCP Routes.
        this.service.scpServer.routes.forEach(item => {
            //Create Variables.
            const map = String(item.map);
            const type = String(item.type);

            //Add to object.
            scpRoutes[map] = type;
        });

        return scpRoutes;
    }

    /**
     * The `Mesh` object which includes `Node`'s.
     * Each `Node` contains its configuration and the `Action`'s that can be called.
     */
    private get meshReport() {
        const mesh: Array<{
            name: string,
            identifier: string,
            host: URL,
            connected: boolean,
            reconnecting: boolean,
            disconnected: boolean,
            node: {
                identifier: string,
                broadcasts: Array<string>,
                replies: Array<string>
            }
        }> = new Array();

        //Get SCP Clients.
        this.service.scpClientManager.clients.forEach(item => {
            const client = {
                name: item.nodeName,
                identifier: item.identifier,
                host: item.url,
                connected: item.connected,
                reconnecting: item.reconnecting,
                disconnected: item.disconnected,
                node: {
                    identifier: item.node.identifier,
                    broadcasts: item.node.broadcasts,
                    replies: item.node.replies
                }
            };
            mesh.push(client);
        });

        return mesh;
    }
}