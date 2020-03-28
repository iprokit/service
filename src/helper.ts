//Import modules
import { RequestOptions } from 'https';
import ip from 'ip';
import fs from 'fs';
import path from 'path';
import { Request } from 'express';

/**
 * The static helper class.
 */
export default class Helper {
    //////////////////////////////
    //////Network
    //////////////////////////////
    /**
     * @returns the docker container address.
     */
    public static getContainerIP() {
        return ip.address();
    }

    /**
     * @returns the docker host address.
     */
    public static getHostIP() {
        //TODO: https://iprotechs.atlassian.net/browse/PMICRO-6
        return '';
    }

    //////////////////////////////
    //////Files
    //////////////////////////////
    /**
     * Finds and gets all the files under the given path and its sub directories.
     * 
     * @param findPath the path to find under.
     * @param options the find options.
     * 
     * @returns the files found with its full path.
     */
    public static getFilePaths(findPath: string, options?: FindOptions) {
        //Set Defaults.
        options = options || {};
        options.files = options.files || {};
        options.directories = options.directories || {};

        return this.findFilePaths(findPath, options);
    }

    /**
     * Finds all the files under the given path and its sub directories.
     * 
     * @param findPath the path to find under.
     * @param options the find options.
     * 
     * @returns the files found with its full path.
     */
    private static findFilePaths(findPath: string, options?: FindOptions) {
        const allFiles = new Array<string>();

        //Reads the file/directory.
        const filesOrDirectories = fs.readdirSync(findPath);

        filesOrDirectories.forEach(fileOrDirectory => {
            //Join findPath with fileOrDirectory.
            const fileOrDirectoryPath = path.join(findPath, fileOrDirectory);

            //Validate if the `fileOrDirectoryPath` is directory or a file.
            if (fs.statSync(fileOrDirectoryPath).isDirectory()) {
                // TODO: Work from here. To break path and do levels.
                console.log(fileOrDirectoryPath, this.filter(fileOrDirectoryPath, options.directories));

                //Validate the filter.
                if (this.filter(fileOrDirectoryPath, options.directories)) {
                    //Recall this function to get files/directories under this path and add them to `allFiles`.
                    Array.prototype.push.apply(allFiles, this.findFilePaths(fileOrDirectoryPath, options));
                }
            } else {
                //Validate the filter.
                if (this.filter(fileOrDirectory, options.files)) {
                    //Add the file to `allFiles`.
                    allFiles.push(fileOrDirectoryPath);
                }
            }
        });

        return allFiles;
    }

    /**
     * Filters the path by checking `options.include` or `options.exclude` and matches the pattern.
     * If no options are provided returns undefined.
     * 
     * @param path the path.
     * @param options the filter options.
     * 
     * @returns true if filter is applied and valid, false otherwise.
     */
    private static filter(path: string, options: FilterOptions) {
        if (options.include) {
            //If the pattern is found in the filter true is returned, false otherwise.
            return this.matchPattern(path, options.include) ? true : false;
        } else if (options.exclude) {
            //If the pattern is found in the filter false is returned, true otherwise.
            return this.matchPattern(path, options.exclude) ? false : true;
        }
    }

    /**
     * Matches the path with pattern in options.
     * 
     * @param path the path.
     * @param options the pattern options.
     * 
     * @returns true if the pattern matches, undefined otherwise.
     */
    private static matchPattern(path: string, options: PatternOptions) {
        if (path.startsWith(options.startsWith)) {
            return true;
        }
        if (path.endsWith(options.endsWith)) {
            return true;
        }
        if (path.includes(options.likeName)) {
            return true;
        }
        if (path === options.match) {
            return true;
        }
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
//////File: Type Definitions
//////////////////////////////
/**
 * Interface for file/directory find options.
 */
export interface FindOptions {
    /**
     * The optional, files to search.
     */
    files?: FilterOptions;

    /**
     * The optional, directories to search.
     */
    directories?: FilterOptions;
}

/**
 * Interface for filtering the `PatternOptions`.
 */
export interface FilterOptions {
    /**
     * The optional, patterns to include.
     */
    include?: PatternOptions;

    /**
     * The optional, patterns to exclude.
     */
    exclude?: PatternOptions;
}

/**
 * Interface for matching pattern.
 */
export interface PatternOptions {
    /**
     * The optional, match pattern with start of string.
     */
    startsWith?: string;

    /**
     * The optional, match pattern with end of string.
     */
    endsWith?: string;

    /**
     * The optional, match pattern that contains the string.
     */
    likeName?: string;

    /**
     * The optional, match the exact string pattern.
     */
    match?: string;
};