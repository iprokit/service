import fs from 'fs';
import path from 'path';

export default class FileUtility{
    public static getFilePaths(givenPath: string, likeName: string, excluses: Array<string>) {
        const allFiles = new Array<string>();

        const filesOrDirectories = fs.readdirSync(givenPath);
        filesOrDirectories.forEach(fileOrDirectory => {
            const fileOrDirectoryPath = path.join(givenPath, fileOrDirectory);

            //Validate if the fileOrDirectoryPath is directory or a file.
            //If its a directory get sub files and add it to allFiles[].
            //If its a file validate isExcluded() then add it to allFiles[].

            if (fs.statSync(fileOrDirectoryPath).isDirectory()) {
                //Getting all files in the sub directory.
                const subFiles = this.getFilePaths(fileOrDirectoryPath, likeName, excluses);
                subFiles.forEach(subFile => {
                    allFiles.push(subFile);
                })
            } else {
                if (fileOrDirectory.includes(likeName)) {
                    if(!this.isExcluded(fileOrDirectoryPath, excluses)){
                        allFiles.push(fileOrDirectoryPath);
                    }
                }
            }
        });
        return allFiles;
    }

    private static isExcluded(file: string, excluses: Array<string>){
        let excluded = false;
        excluses.forEach(excluse => {
            if(file.includes(excluse)){
                excluded = true;
            }
        });
        return excluded;
    }
}