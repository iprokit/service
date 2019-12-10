//Import modules
import { RequestOptions } from 'https';
import ip from 'ip';
import fs from 'fs';
import path from 'path';

//Local Imports
import { projectPath } from './microservice';

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
        return ''; //TODO: This should become dynamic
    }

    /////////////////////////
    ///////Files
    /////////////////////////
    public static getFilePaths(paths: string, options?: FileOptions){
        //Set Defaults.
        options = options || {};
        options.excludes = options.excludes || [];

        //Adding files to Exclude.
        options.excludes.push('node_modules');
        options.excludes.push('.babelrc');
        options.excludes.push('package.json');
        options.excludes.push('package-lock.json');
        options.excludes.push('git');
        options.excludes.push('.env');

        return(this.findFilePaths(projectPath + paths, options));
    }

    private static findFilePaths(paths: string, options?: FileOptions) {
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
                    Array.prototype.push.apply(allFiles, this.findFilePaths(fileOrDirectoryPath, options));
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
    public static generateProxyHeaders(sourceRequest: any, targetRequest: RequestOptions){
        const proxyObject = sourceRequest.proxy;
        if(proxyObject){
            for(let key in proxyObject){
                const headerName = 'proxy-' + key;
                const headerObject = proxyObject[key];
                targetRequest.headers[headerName] = JSON.stringify(headerObject);
            }
        }
    }

    public static generateProxyObjects(request: any){
        //Create Empty Proxy object.
        request.proxy = {};

        let proxyHeaders = request.headers;
        for(let key in proxyHeaders){
            if(key.includes('proxy-')){
                const objectKey = key.split('-')[1];
                const objectValue = proxyHeaders[key];
                request.proxy[objectKey] = JSON.parse(objectValue);

                //Delete proxy headers.
                delete request.headers[key];
            }
        }
    }
}