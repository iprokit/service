import fs from 'fs';
import path from 'path';

export default class FileUtility{
    public static getFilePaths(givenPath: string, likeName: string, excludes: Array<string>) {
        const allFiles = new Array<string>();

        const filesOrDirectories = fs.readdirSync(givenPath);
        filesOrDirectories.forEach(fileOrDirectory => {
            const fileOrDirectoryPath = path.join(givenPath, fileOrDirectory);

            //Validate if the fileOrDirectoryPath is directory or a file.
            //If its a directory get sub files and add it to allFiles[].
            //If its a file validate isExcluded() then add it to allFiles[].

            if (fs.statSync(fileOrDirectoryPath).isDirectory()) {
                //Getting all files in the sub directory.
                const subFiles = this.getFilePaths(fileOrDirectoryPath, likeName, excludes);
                subFiles.forEach(subFile => {
                    allFiles.push(subFile);
                })
            } else {
                if (fileOrDirectory.includes(likeName)) {
                    if(!this.isExcluded(fileOrDirectoryPath, excludes)){
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