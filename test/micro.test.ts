//Import Libs.
import mocha from 'mocha';
import assert from 'assert';

//Import Local.
import micro from '../lib/micro';

mocha.describe('Micro Test', () => {
    mocha.it('should create Micro with default variables', (done) => {
        const service = micro();
        assert.notDeepEqual(service, undefined);
        done();
    });
});