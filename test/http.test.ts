//Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';
import { get } from 'http';

//Import Local.
import { HttpServer, Request, Response, NextFunction } from '../lib';

const host = '127.0.0.1';
const port = 3000;

mocha.describe('HTTP Test', () => {
    mocha.describe('Constructor Test', () => {
        mocha.it('should construct server', (done) => {
            const server = new HttpServer();
            assert.notDeepStrictEqual(server, undefined);
            done();
        });
    });

    mocha.describe('HTTP Method Test', () => {
        let server: HttpServer;

        const getHandler = () => {
            return (request: Request, response: Response, next: NextFunction) => {
                response.writeHead(200);
                response.end('');
            }
        }

        mocha.beforeEach(async () => {
            server = new HttpServer();
            server.get('/user/:id', getHandler());
            server.listen(port);
            await once(server, 'listening');
        });

        mocha.afterEach(async () => {
            server.close();
            await once(server, 'close');
        });

        mocha.it('Match Param Test', (done) => {
            const request = get({ host, port, method: 'GET', path: '/user/13543634?username=rutvik&password=123' }, (response) => {
                response.resume();
                done();
            });
            request.end('');
        });
    });
});