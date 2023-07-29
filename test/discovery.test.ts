//Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';

//Import Local.
import { DiscoveryLink } from '../lib';

const address = '224.0.0.1';
const host = '127.0.0.1';
const ports = { http: 3000, scp: 6000, discovery: 5000 }

mocha.describe('Discovery Test', () => {
    mocha.describe('Constructor Test', () => {
        mocha.it('should construct link', () => {
            const link = new DiscoveryLink('ID', { http: 0, scp: 0, host: '' });
            assert.deepStrictEqual(link.identifier, 'ID');
            assert.deepStrictEqual(link.args, { http: '0', scp: '0', host: '' });
            assert.deepStrictEqual(link.listening, false);
            assert.deepStrictEqual(link.pods.length, 1);
            assert.deepStrictEqual(link.remoteServices.length, 0);
        });
    });

    mocha.describe('Register Test', () => {
        let link: DiscoveryLink;

        mocha.beforeEach(async () => {
            link = new DiscoveryLink('A', { http: ports.http, scp: ports.scp, host: host });
            link.bind(ports.discovery, address);
            await once(link, 'listening');
        });

        mocha.afterEach(async () => {
            link.close();
            await once(link, 'close');
        });

        mocha.it('should register remote service', () => {
            //TODO: Work from here.
        });
    });
});