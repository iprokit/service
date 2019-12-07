//Import modules
import { RequestOptions } from 'https';
import ip from 'ip';
import fs from 'fs';
import path from 'path';

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
    public static getFilePaths(givenPath: string, likeName: string, excludes: Array<string>){
        //Adding files to Exclude.
        excludes.push('node_modules');
        excludes.push('git');

        return(this.findFilePaths(global.projectPath + givenPath, likeName, excludes));
    }

    private static findFilePaths(givenPath: string, likeName: string, excludes: Array<string>) {
        const allFiles = new Array<string>();

        const filesOrDirectories = fs.readdirSync(givenPath);
        filesOrDirectories.forEach(fileOrDirectory => {
            const fileOrDirectoryPath = path.join(givenPath, fileOrDirectory);
            
            //Validate isExcluded()
            if(!this.isExcluded(fileOrDirectoryPath, excludes)){
                //Validate if the fileOrDirectoryPath is directory or a file.
                //If its a directory get sub files and add it to allFiles[].

                if (fs.statSync(fileOrDirectoryPath).isDirectory()) {
                    //Getting all files in the sub directory and adding to allFiles[].
                    Array.prototype.push.apply(allFiles, this.findFilePaths(fileOrDirectoryPath, likeName, excludes));
                } else {
                    if (fileOrDirectory.includes(likeName)) {
                        allFiles.push(fileOrDirectoryPath);
                    }
                }
            }
        });
        return allFiles;
    }

    private static isExcluded(file: string, excludes: Array<string>){
        let excluded = false;
        excludes.forEach(exclude => {
            if(file.includes(exclude)){
                excluded = true;
            }
        });
        return excluded;
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