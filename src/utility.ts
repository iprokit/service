//Import modules
import { RequestOptions } from 'https';
import ip from 'ip';
import fs from 'fs';
import path from 'path';
import { Request } from 'express';

//Types: FileOptions
export type FileOptions = {
    excludes?: Array<string>,
    startsWith?: string,
    endsWith?: string,
    likeName?: string
};

export default class Utility {
    /////////////////////////
    ///////Network
    /////////////////////////
    public static getContainerIP(){
        return ip.address();
    }
    
    public static getHostIP(){
        //TODO: This should become dynamic
        return '';
    }

    /////////////////////////
    ///////Files
    /////////////////////////
    public static getFilePaths(paths: string, options?: FileOptions){
        //Sub function to find files.
        const _findFilePaths = (paths: string, options?: FileOptions) => {
            const allFiles = new Array<string>();

            const filesOrDirectories = fs.readdirSync(paths);
            filesOrDirectories.forEach(fileOrDirectory => {
                const fileOrDirectoryPath = path.join(paths, fileOrDirectory);
                
                //Validate if excluded
                if(!options.excludes.find(excludedFile => fileOrDirectoryPath.includes(excludedFile))){
                    //Validate if the fileOrDirectoryPath is directory or a file.
                    //If its a directory get sub files and add it to allFiles[].

                    if(fs.statSync(fileOrDirectoryPath).isDirectory()) {
                        //Getting all files in the sub directory and adding to allFiles[].
                        Array.prototype.push.apply(allFiles, _findFilePaths(fileOrDirectoryPath, options));
                    } else {
                        if(options.startsWith){
                            if(fileOrDirectory.startsWith(options.startsWith)){
                                allFiles.push(fileOrDirectoryPath);
                            }
                        }else if(options.endsWith){
                            if(fileOrDirectory.endsWith(options.endsWith)){
                                allFiles.push(fileOrDirectoryPath);
                            }
                        }else if(options.likeName){
                            if(fileOrDirectory.includes(options.likeName)){
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

        //Adding files to Exclude.
        options.excludes.push('git');
        options.excludes.push('node_modules');
        options.excludes.push('package.json');
        options.excludes.push('package-lock.json');
        options.excludes.push('.babelrc');
        options.excludes.push('.env');

        const projectPath = global.service.projectPath;

        return _findFilePaths(projectPath + paths, options);
    }

    /////////////////////////
    ///////Comm
    /////////////////////////
    public static convertToTopic(className: string, functionName: string){
        const topic = ('/' + className + '/' + functionName);
        return topic;
    }

    public static convertToFunction(topic: string){
        const topicLevels = topic.split('/');

        let className = topicLevels[1];
        let functionName = topicLevels[2];

        if(className || functionName){
            return {className, functionName};
        }else{
            return undefined;
        }
    }

    /////////////////////////
    ///////Proxy
    /////////////////////////
    public static generateProxyHeaders(sourceRequest: Request, targetRequest: RequestOptions){
        const proxyObject = Object.getPrototypeOf(sourceRequest).proxy;
        if(proxyObject){
            //Convert Proxy dict to array and get each proxy.
            Object.entries(proxyObject).forEach(([name, proxy]) => {
                targetRequest.headers['proxy-' + name] = JSON.stringify(proxy);
            });
        }
    }

    public static generateProxyObjects(request: Request){
        //Create Empty Proxy object.
        Object.getPrototypeOf(request).proxy = {};

        let proxyHeaders = request.headers;
        //Convert Proxy headers to array and get each proxy.
        Object.entries(proxyHeaders).find(([name, proxy]) => {
            if(name.startsWith('proxy-')){
                const objectKey = name.split('-')[1];
                const objectValue = proxy;
                Object.getPrototypeOf(request).proxy[objectKey] = JSON.parse(objectValue as string);

                //Delete proxy headers.
                delete request.headers[name];
            }
        });
    }
}