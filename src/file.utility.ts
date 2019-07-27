import fs from 'fs';

export default class FileUtility{
    public static getFilePaths(rootPath: string, likeName: string) {
        const allPaths = new Array<string>();
        const files = fs.readdirSync(rootPath);
        files.forEach(file => {
            if (fs.statSync(rootPath + '/' + file).isDirectory()) {
                let subPaths = this.getFilePaths(rootPath + '/' + file, likeName);
                subPaths.forEach(subPath => {
                    allPaths.push(subPath);
                })
            } else {
                if (file.includes(likeName)) {
                    const filePath = rootPath + '/' + file;
                    allPaths.push(filePath);
                }
            }
        });
        return allPaths;
    }
}