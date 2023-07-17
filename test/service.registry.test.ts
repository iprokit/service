//Import Libs.
import mocha from 'mocha';
import assert from 'assert';

//Import Local.
import { ServiceRegistry } from '../lib';

const address = '224.0.0.1';
const port = 5000;

mocha.describe('Service Registry Test', () => {
    mocha.describe('Constructor Test', () => {
        mocha.it('should construct registry with default variables', () => {
            const registry = new ServiceRegistry('ID');
            assert.deepStrictEqual(registry.identifier, 'ID');
            assert.deepStrictEqual(registry.args, {});
            assert.deepStrictEqual(registry.listening, false);
            assert.deepStrictEqual(registry.pods.length, 1);
        });
    });
});