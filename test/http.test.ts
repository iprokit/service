//Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';

//Import Local.
import { HttpServer, RequestHandler, HttpStatusCode } from '../lib';
import { createString, clientRequest } from './util';

const host = '127.0.0.1';
const port = 3000;

mocha.describe('HTTP Test', () => {
    mocha.describe('Route Test', () => {
        let server: HttpServer;

        const nextHandler = (key: string): RequestHandler => {
            return (request, response: any, next) => {
                if (response.next === undefined) response.next = '';
                response.next += key;
                next();
            }
        }

        const requestHandler = (): RequestHandler => {
            return async (request, response: any, next) => {
                let body = ''
                for await (const chunk of request) {
                    body += chunk;
                }
                response.writeHead(HttpStatusCode.OK).end(`${body}-${response.next}-${request.query.x}${request.query.y}`);
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

        mocha.it('should receive response to GET request', async () => {
            //Client
            const { response, body: responseBody } = await clientRequest('GET', host, port, '/a/1/b/2/c?x=1&y=1', '');
            assert.deepStrictEqual(response.statusCode, HttpStatusCode.OK);
            assert.deepStrictEqual(responseBody, `-a1a2-11`);
        });

        mocha.it('should receive response to POST request', async () => {
            //Client
            const requestBody = createString(1000);
            const { response, body: responseBody } = await clientRequest('POST', host, port, '/a?x=2&y=2', requestBody);
            assert.deepStrictEqual(response.statusCode, HttpStatusCode.OK);
            assert.deepStrictEqual(responseBody, `${requestBody}-a-22`);
        });

        mocha.it('should receive response to PUT request', async () => {
            //Client
            const requestBody = createString(1000);
            const { response, body: responseBody } = await clientRequest('PUT', host, port, '/b?x=3&y=3', requestBody);
            assert.deepStrictEqual(response.statusCode, HttpStatusCode.OK);
            assert.deepStrictEqual(responseBody, `${requestBody}-b-33`);
        });

        mocha.it('should receive response to PATCH request', async () => {
            //Client
            const requestBody = createString(1000);
            const { response, body: responseBody } = await clientRequest('PATCH', host, port, '/c?x=4&y=4', requestBody);
            assert.deepStrictEqual(response.statusCode, HttpStatusCode.OK);
            assert.deepStrictEqual(responseBody, `${requestBody}-c-44`);
        });

        mocha.it('should receive response to DELETE request', async () => {
            //Client
            const { response, body: responseBody } = await clientRequest('DELETE', host, port, '/d?x=5&y=5', '');
            assert.deepStrictEqual(response.statusCode, HttpStatusCode.OK);
            assert.deepStrictEqual(responseBody, `-d-55`);
        });
    });
});