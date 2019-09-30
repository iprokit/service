//Import modules
import fs from 'fs';
import path from 'path';

export default class FileUtility{
    public static getFilePaths(givenPath: string, likeName: string, excludes: Array<string>){
        //Adding files to Exclude.
        excludes.push('node_modules');
        excludes.push('git');

        return(this._getFilePaths(global.projectPath + givenPath, likeName, excludes));
    }

    private static _getFilePaths(givenPath: string, likeName: string, excludes: Array<string>) {
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
                    Array.prototype.push.apply(allFiles, this._getFilePaths(fileOrDirectoryPath, likeName, excludes));
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
}