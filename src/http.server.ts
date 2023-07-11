//Import Libs.
import { Server, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import { ParsedUrlQuery } from 'querystring';

export default class HttpServer extends Server {
    public readonly routes: Array<Route>;

    constructor() {
        super();

        //Initialize Variables.
        this.routes = new Array();

        //Bind listeners.
        this.onRequest = this.onRequest.bind(this);

        //Add listeners.
        this.addListener('request', this.onRequest);
    }

    //////////////////////////////
    //////Event Listeners
    //////////////////////////////
    private onRequest(request: Request, response: Response) {
        //Set: Request.
        const { pathname, query } = parse(request.url, true);
        request.path = pathname;
        request.query = query;

        //Below line will blow your mind! 🤯
        this.dispatch(0, request, response);
    }

    //////////////////////////////
    //////HTTP Methods
    //////////////////////////////
    public get(path: string, handler: RequestHandler) {
        this.routes.push({ method: 'GET', path, handler });
    }

    public post(path: string, handler: RequestHandler) {
        this.routes.push({ method: 'POST', path, handler });
    }

    public put(path: string, handler: RequestHandler) {
        this.routes.push({ method: 'PUT', path, handler });
    }

    public patch(path: string, handler: RequestHandler) {
        this.routes.push({ method: 'PATCH', path, handler });
    }

    public delete(path: string, handler: RequestHandler) {
        this.routes.push({ method: 'DELETE', path, handler });
    }

    public all(path: string, handler: RequestHandler) {
        this.routes.push({ method: 'ALL', path, handler });
    }

    public use(handler: RequestHandler) {
        this.routes.push({ method: 'ALL', path: '*', handler });
    }

    //////////////////////////////
    //////Dispatch
    //////////////////////////////
    private dispatch(index: number, request: Request, response: Response) {
        const route = this.routes[index++];

        //Need I say more.
        if (!route) return;

        //Shits about to go down! 😎
        const method = (route.method === request.method || route.method === 'ALL') ? true : false;
        const matchPath = request.path.match(`^${route.path.replace(/:[^\s/]+/g, '([^/]+)')}$`);

        if (method && matchPath) {
            //Route found, lets extract params and execute the handler.
            const paramKeys = route.path.match(/:[^\s/]+/g)?.map((param) => param.slice(1));
            request.params = paramKeys.reduce((params: { [key: string]: string }, param: string, index: number) => (params[param] = matchPath[index + 1], params), {});

            const next: NextFunction = () => this.dispatch(index, request, response);
            route.handler(request, response, next);
        } else {
            //Route not found, lets keep going though the loop.
            this.dispatch(index, request, response);
        }
    }
}

//////////////////////////////
/////Request/Response
//////////////////////////////
export interface Request extends IncomingMessage {
    path: string;
    params: { [key: string]: string };
    query: ParsedUrlQuery;
}
export interface Response extends ServerResponse { }

//////////////////////////////
/////Route
//////////////////////////////
export interface Route {
    method: HttpMethod;
    path: string;
    handler: RequestHandler;
}

export type HttpMethod = 'ALL' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type RequestHandler = (request: Request, response: Response, next: NextFunction) => void;

export type NextFunction = () => void;