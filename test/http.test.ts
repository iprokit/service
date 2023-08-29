//Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';

//Import Local.
import { HttpServer, RequestHandler, HttpStatusCode } from '../lib';
import { clientRequest } from './util';

const host = '127.0.0.1';
const port = 3000;

mocha.describe('HTTP Test', () => {
    mocha.describe('Route Test', () => {
        let server: HttpServer;

        const nextHandler = (key: string): RequestHandler => {
            return (request, response, next) => {
                if ((response as any).body === undefined) (response as any).body = '';
                (response as any).body += key;
                next();
            }
        }

        const requestHandler = (): RequestHandler => {
            return (request, response, next) => {
                response.writeHead(HttpStatusCode.OK).end(`${(response as any).body}-${request.query.x}${request.query.y}`);
            }
        }

        mocha.beforeEach(async () => {
            server = new HttpServer();
            server.all('*', nextHandler(''));
            server.get('/a/:id/*', nextHandler('a1'));
            server.get('/a/:id/b/:id/*', nextHandler('a2'));
            server.get('/a/:id/b/:id/c/:id', nextHandler('a3'));
            server.post('/a', nextHandler('a'));
            server.put('/b', nextHandler('b'));
            server.patch('/c', nextHandler('c'));
            server.delete('/d', nextHandler('d'));
            server.all('/*', requestHandler());
            server.listen(port);
            await once(server, 'listening');
        });

        mocha.afterEach(async () => {
            server.close();
            await once(server, 'close');
        });

        mocha.it('should respond to GET request', async () => {
            //Client
            const { response, body } = await clientRequest('GET', host, port, '/a/1/b/2/c?x=1&y=1', '');
            assert.deepStrictEqual(response.statusCode, HttpStatusCode.OK);
            assert.deepStrictEqual(body, 'a1a2-11');
        });

        mocha.it('should respond to POST request', async () => {
            //Client
            const { response, body } = await clientRequest('POST', host, port, '/a?x=2&y=2', '');
            assert.deepStrictEqual(response.statusCode, HttpStatusCode.OK);
            assert.deepStrictEqual(body, 'a-22');
        });

        mocha.it('should respond to PUT request', async () => {
            //Client
            const { response, body } = await clientRequest('PUT', host, port, '/b?x=3&y=3', '');
            assert.deepStrictEqual(response.statusCode, HttpStatusCode.OK);
            assert.deepStrictEqual(body, 'b-33');
        });

        mocha.it('should respond to PATCH request', async () => {
            //Client
            const { response, body } = await clientRequest('PATCH', host, port, '/c?x=4&y=4', '');
            assert.deepStrictEqual(response.statusCode, HttpStatusCode.OK);
            assert.deepStrictEqual(body, 'c-44');
        });

        mocha.it('should respond to DELETE request', async () => {
            //Client
            const { response, body } = await clientRequest('DELETE', host, port, '/d?x=5&y=5', '');
            assert.deepStrictEqual(response.statusCode, HttpStatusCode.OK);
            assert.deepStrictEqual(body, 'd-55');
        });
    });
});