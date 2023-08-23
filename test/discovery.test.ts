//Import Libs.
import mocha from 'mocha';
import assert from 'assert';
import { once } from 'events';

//Import Local.
import { DiscoveryMesh, Node } from '../lib';

const address = '224.0.0.1';
const host = '127.0.0.1';
const ports = { http: 3000, scp: 6000, discovery: 5000 }

mocha.describe('Discovery Test', () => {
    mocha.describe('Register Test', () => {
        let mesh: DiscoveryMesh;

        mocha.beforeEach(async () => {
            mesh = new DiscoveryMesh();
            mesh.join(ports.discovery, address, 'SVC0', { http: ports.http, scp: ports.scp, host: host });
            await once(mesh, 'listening');
        });

        mocha.afterEach(async () => {
            mesh.close();
            await once(mesh, 'close');
        });

        mocha.it('should emit node event on join', (done) => {
            //Mesh
            mesh.on('node', async (node: Node) => {
                assert.deepStrictEqual(node.identifier, meshA.identifier);
                meshA.close(() => done()); //Calling End
            });

            //Mesh A
            const meshA = new DiscoveryMesh();
            meshA.join(ports.discovery, address, 'SVC1', { http: 3001, scp: 6001, host: host });
        });
    });
});