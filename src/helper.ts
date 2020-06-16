//Import modules
import fs from 'fs';
import path from 'path';
import { Request, Response, NextFunction } from 'express';
import { RequestOptions } from 'https';

/**
 * The static helper class.
 */
export default class Helper {
    //////////////////////////////
    //////Bind
    //////////////////////////////
    /**
     * Binds the function to `thisArg`.
     * 
     * @param fn the function to bind.
     * @param thisArg the argument to bind the function.
     */
    public static bind(fn: Function, thisArg: any) {
        //Bind the function.
        thisArg[fn.name] = thisArg[fn.name].bind(thisArg);

        //Set function name.
        Object.defineProperty(thisArg[fn.name], 'name', { value: fn.name });

        return thisArg[fn.name];
    }
    //////////////////////////////
    //////File
    //////////////////////////////
    /**
     * Finds and gets all the files under the given path and its sub directories.
     * 
     * Ignores the directory `node_modules`.
     * 
     * @param findPath the path to find under.
     * @param options the find options.
     * 
     * @returns the files found with its full path.
     */
    public static findFilePaths(findPath: string, options: FileOptions) {
        //The files and directories to exclude.
        let excludes: Array<string> = Array();

        //Add default files and directories.
        excludes.push('node_modules');

        /**
         * Sub-function for self call.
         * 
         * @param findPath the path to find under.
         * @param options the find options.
         * 
         * @returns the files found with its full path.
         */
        const findFilePaths = (findPath: string, options: FileOptions) => {
            //The files to return.
            const allFiles = new Array<string>();

            //Reads the file/directory.
            const filesOrDirectories = fs.readdirSync(findPath);

            filesOrDirectories.forEach(fileOrDirectory => {
                //Join findPath with fileOrDirectory.
                const fileOrDirectoryPath = path.join(findPath, fileOrDirectory);

                //Validate if the `fileOrDirectory` has to be excluded.
                if (excludes.find(exclude => fileOrDirectory !== exclude)) {
                    //Validate if the `fileOrDirectoryPath` is directory or a file.
                    if (fs.statSync(fileOrDirectoryPath).isDirectory()) {
                        //Recall this function to get files/directories under this path and add them to `allFiles`.
                        Array.prototype.push.apply(allFiles, this.findFilePaths(fileOrDirectoryPath, options));
                    } else {
                        //Validate the filter.
                        if (this.filterFile(fileOrDirectoryPath, options)) {
                            //Add the file to `allFiles`.
                            allFiles.push(fileOrDirectoryPath);
                        }
                    }
                }
            });

            return allFiles;
        }

        return findFilePaths(findPath, options);
    }

    /**
     * Filters the file by checking `options.include` or `options.exclude` and matches the file.
     * If no options are provided returns undefined.
     * 
     * @param file the file.
     * @param options the filter options.
     * 
     * @returns true if filter is applied and valid, false otherwise.
     */
    public static filterFile(file: string, options: FileOptions) {
        if (options.include) {
            //If the pattern is found; true is returned, false otherwise.
            return this.matchFilePattern(file, options.include) ? true : false;
        } else if (options.exclude) {
            //If the pattern is found; false is returned, true otherwise.
            return this.matchFilePattern(file, options.exclude) ? false : true;
        }
    }

    /**
     * Matches the file with pattern in options.
     * 
     * @param file the file.
     * @param options the pattern options.
     * 
     * @returns true if the pattern matches, undefined otherwise.
     */
    public static matchFilePattern(file: string, options: FilePattern) {
        const _file = path.parse(file);

        if (options.startsWith && options.startsWith.find(pattern => _file.name.startsWith(pattern))) {
            return true;
        }
        if (options.endsWith && options.endsWith.find(pattern => _file.name.endsWith(pattern))) {
            return true;
        }
        if (options.likeName && options.likeName.find(pattern => _file.name.includes(pattern))) {
            return true;
        }
        if (options.extension && options.extension.find(pattern => _file.ext === pattern)) {
            return true;
        }
    }

    //////////////////////////////
    //////Proxy
    //////////////////////////////
    /**
     * Generate proxy headers from proxy objects.
     * This is used to pass proxy headers from gateway service to a service during proxy redirect.
     */
    public static generateProxyHeaders(sourceRequest: Request, targetRequest: RequestOptions) {
        const proxyObject = Object.getPrototypeOf(sourceRequest).proxy;
        if (proxyObject) {
            //Convert Proxy dict to array and get each proxy.
            Object.entries(proxyObject).forEach(([name, proxy]) => {
                targetRequest.headers[`proxy-${name}`] = JSON.stringify(proxy);
            });
        }
    }

    /**
     * Generate proxy objects from proxy headers.
     * This is used to unpack proxy objects into the service.
     */
    public static generateProxyObjects(request: Request, response: Response, next: NextFunction) {
        //Create Empty Proxy object.
        Object.getPrototypeOf(request).proxy = {};

        //Convert Proxy headers to array and get each proxy.
        Object.entries(request.headers).find(([name, proxy]) => {
            if (name.startsWith('proxy-')) {
                const objectKey = name.split('-')[1];
                const objectValue = proxy;
                Object.getPrototypeOf(request).proxy[objectKey] = JSON.parse(objectValue as string);

                //Delete proxy headers.
                delete request.headers[name];
            }
        });

        next();
    }
}

//////////////////////////////
//////File: Options
//////////////////////////////
/**
 * File find options.
 */
export type FileOptions = {
    /**
     * The optional, files to include.
     */
    include?: FilePattern;

    /**
     * The optional, files to exclude.
     */
    exclude?: FilePattern;
}

/**
 * Files matching options.
 */
export type FilePattern = {
    /**
     * The optional, filename that starts with.
     */
    startsWith?: Array<string>;

    /**
     * The optional, filename that ends with.
     */
    endsWith?: Array<string>;

    /**
     * The optional, filename that is like.
     */
    likeName?: Array<string>;

    /**
     * The optional, file extention that has extension.
     */
    extension?: Array<string>;
}