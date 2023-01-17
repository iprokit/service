//Import Libs.
import mocha from 'mocha';
import assert from 'assert';

//Import Local.
import Client from '../lib/scp/client';

mocha.describe('SCP Test', () => {
    mocha.describe('Constructor Test', () => {
        mocha.it('should construct client', (done) => {
            const identifier = 'C1';
            const client = new Client(identifier);
            assert.deepStrictEqual(client.identifier, identifier);
            done();
        });
    });
});