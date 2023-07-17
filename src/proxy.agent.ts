//Import Libs.
import { request } from 'http';

//Import Local.
import { Request, Response, RequestHandler } from './http.server';
import { NextFunction } from './common';

export default class ProxyAgent {
    private _host: string;
    private _port: number;
    private _linked: boolean;

    constructor() {

    }

    public forward(path?: string): RequestHandler {
        return (request: Request, response: Response, next: NextFunction) => {

        }
    }
}