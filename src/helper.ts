//Import modules
import { RequestOptions } from 'https';
import IP from 'ip';
import FS from 'fs';
import Path from 'path';
import { Request } from 'express';

/**
 * The static helper class required.
 */
export default class Helper {
    //////////////////////////////
    //////Network
    //////////////////////////////
    /**
     * @returns the docker container address.
     */
    public static getContainerIP() {
        return IP.address();
    }

    /**
     * @returns the docker host address.
     */
    public static getHostIP() {
        //TODO: This should become dynamic
        return '';
    }

    //////////////////////////////
    //////Files
    //////////////////////////////
    /**
     * Get all the files paths under the given root path and its sub-directories.
     * 
     * @param path the root path.
     * @param options the file options.
     * 
     * @returns all the files under the root path and its sub-directories.
     */
    public static getFilePaths(path: string, options?: FileOptions) {
        /**
         * Get all the files under the given root path.
         * 
         * @param _paths the root path.
         * @param _options the file options.
         * 
         * @returns the files found under the root path.
         * 
         * @function
         */
        const _findFilePaths = (_paths: string, _options?: FileOptions) => {
            const allFiles = new Array<string>();

            const filesOrDirectories = FS.readdirSync(_paths);
            filesOrDirectories.forEach(fileOrDirectory => {
                const fileOrDirectoryPath = Path.join(_paths, fileOrDirectory);

                //Validate if excluded
                if (!_options.excludes.find(excludedFile => fileOrDirectoryPath.includes(excludedFile))) {
                    //Validate if the fileOrDirectoryPath is directory or a file.
                    //If its a directory get sub files and add it to allFiles[].

                    if (FS.statSync(fileOrDirectoryPath).isDirectory()) {
                        //Getting all files in the sub directory and adding to allFiles[].
                        Array.prototype.push.apply(allFiles, _findFilePaths(fileOrDirectoryPath, _options));
                    } else {
                        if (_options.startsWith) {
                            if (fileOrDirectory.startsWith(_options.startsWith)) {
                                allFiles.push(fileOrDirectoryPath);
                            }
                        } else if (_options.endsWith) {
                            if (fileOrDirectory.endsWith(_options.endsWith)) {
                                allFiles.push(fileOrDirectoryPath);
                            }
                        } else if (_options.likeName) {
                            if (fileOrDirectory.includes(_options.likeName)) {
                                allFiles.push(fileOrDirectoryPath);
                            }
                        }
                    }
                }
            });
            return allFiles;
        }

        //Set Defaults.
        options = options || {};
        options.excludes = options.excludes || [];

        return _findFilePaths(path, options);
    }

    //////////////////////////////
    //////Proxy
    //////////////////////////////
    /**
     * Generate proxy headers from proxy objects.
     * This is used to pass proxy headers from gateway service to micro-service/general-service during proxy redirect.
     * 
     * @param sourceRequest the source service request.
     * @param targetRequest the target service request.
     */
    public static generateProxyHeaders(sourceRequest: Request, targetRequest: RequestOptions) {
        const proxyObject = Object.getPrototypeOf(sourceRequest).proxy;
        if (proxyObject) {
            //Convert Proxy dict to array and get each proxy.
            Object.entries(proxyObject).forEach(([name, proxy]) => {
                targetRequest.headers['proxy-' + name] = JSON.stringify(proxy);
            });
        }
    }

    /**
     * Generate proxy objects from proxy headers.
     * This is used to unpack proxy objects into the service.
     * 
     * @param request the request object to unpack the proxy objects.
     */
    public static generateProxyObjects(request: Request) {
        //Create Empty Proxy object.
        Object.getPrototypeOf(request).proxy = {};

        let proxyHeaders = request.headers;
        //Convert Proxy headers to array and get each proxy.
        Object.entries(proxyHeaders).find(([name, proxy]) => {
            if (name.startsWith('proxy-')) {
                const objectKey = name.split('-')[1];
                const objectValue = proxy;
                Object.getPrototypeOf(request).proxy[objectKey] = JSON.parse(objectValue as string);

                //Delete proxy headers.
                delete request.headers[name];
            }
        });
    }
}

//////////////////////////////
//////FileOptions
//////////////////////////////
/**
 * Interface for the file options.
 */
export interface FileOptions {
    /**
     * The optional, files to exclude.
     */
    excludes?: Array<string>;

    /**
     * The optional, files that start with.
     */
    startsWith?: string;

    /**
     * The optional, files that end with.
     */
    endsWith?: string;

    /**
     * The optional, files that are like.
     */
    likeName?: string;
};