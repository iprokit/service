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

    mocha.describe('Route Test', () => {
        let server: HttpServer;

        const nextHandler = (key: string) => {
            return (request: Request, response: Response, next: NextFunction) => {
                if (response.body === undefined) response.body = '';
                response.body += key;
                next();
            }
        }

        const requestHandler = () => {
            return (request: Request, response: Response, next: NextFunction) => {
                response.writeHead(200);
                response.end(response.body);
            }
        }

        mocha.beforeEach(async () => {
            server = new HttpServer();
            server.use(nextHandler(''));
            server.get('/a', nextHandler('a1'));
            server.get('/a/:id', nextHandler('a2'));
            server.get('/a/:id/b', nextHandler('a3'));
            server.get('/a/:id/b/:id', nextHandler('a4'));
            server.post('/b', nextHandler('b'));
            server.put('/c', nextHandler('c'));
            server.patch('/d', nextHandler('d'));
            server.delete('/e', nextHandler('e'));
            server.all('/', requestHandler());
            server.listen(port);
            await once(server, 'listening');
        });

        mocha.afterEach(async () => {
            server.close();
            await once(server, 'close');
        });

        mocha.it('should respond to request when path matches', (done) => {
            const request = get({ host, port, method: 'GET', path: '/a/1/b/2/c' }, async (response) => {
                let chunks = '';
                for await (const chunk of response) {
                    chunks += chunk;
                }
                assert.deepStrictEqual(response.statusCode, 200);
                assert.deepStrictEqual(chunks, 'a1a2a3a4');
                done();
            });
            request.end('');
        });
    });
});