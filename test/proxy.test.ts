//Import Libs.
import mocha from 'mocha';
import assert from 'assert';

//Import Local.
import { ProxyAgent } from '../lib';

const host = '127.0.0.1';
const port = 3000;

mocha.describe('Proxy Test', () => {
    mocha.describe('Constructor Test', () => {
        mocha.it('should construct proxy', () => {
            const proxyAgent = new ProxyAgent();
        });
    });
});