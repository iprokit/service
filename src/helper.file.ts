//Import modules
import fs from 'fs';
import path from 'path';

/**
 * The static helper class.
 */
export default class FileHelper {
    /**
     * Finds and gets all the files under the given path and its sub directories.
     * 
     * @param findPath the path to find under.
     * @param options the find options.
     * 
     * @returns the files found with its full path.
     */
    public static getFilePaths(findPath: string, options?: Find) {
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
    private static findFilePaths(findPath: string, options?: Find) {
        const allFiles = new Array<string>();

        //Reads the file/directory.
        const filesOrDirectories = fs.readdirSync(findPath);

        filesOrDirectories.forEach(fileOrDirectory => {
            //Join findPath with fileOrDirectory.
            const fileOrDirectoryPath = path.join(findPath, fileOrDirectory);

            //Validate if the `fileOrDirectoryPath` is directory or a file.
            if (fs.statSync(fileOrDirectoryPath).isDirectory()) {
                //Validate the filter.
                if (this.filterDirectory(fileOrDirectoryPath, fileOrDirectory, options.directories)) {
                    //Recall this function to get files/directories under this path and add them to `allFiles`.
                    Array.prototype.push.apply(allFiles, this.findFilePaths(fileOrDirectoryPath, options));
                }
            } else {
                //Validate the filter.
                if (this.filterFile(fileOrDirectory, options.files)) {
                    //Add the file to `allFiles`.
                    allFiles.push(fileOrDirectoryPath);
                }
            }
        });

        return allFiles;
    }

    //////////////////////////////
    //////Filters
    //////////////////////////////
    /**
     * Filters the file by checking `options.include` or `options.exclude` and matches the file.
     * If no options are provided returns undefined.
     * 
     * @param file the file.
     * @param options the filter options.
     * 
     * @returns true if filter is applied and valid, false otherwise.
     */
    private static filterFile(file: string, options: Filter<FilePattern>) {
        if (options.include) {
            //If the pattern is found; true is returned, false otherwise.
            return this.matchFilePattern(file, options.include) ? true : false;
        } else if (options.exclude) {
            //If the pattern is found; false is returned, true otherwise.
            return this.matchFilePattern(file, options.exclude) ? false : true;
        }
    }

    /**
     * Filters the directory by checking `options.include` or `options.exclude` and matches the directory.
     * If no options are provided returns undefined.
     * 
     * @param directoryPath the path of the directory.
     * @param directory the directory.
     * @param options the filter options.
     * 
     * @returns true if filter is applied and valid, false otherwise.
     */
    private static filterDirectory(directoryPath: string, directory: string, options: Filter<DirectoryPattern>) {
        if (options.include) {
            //If the pattern is found; true is returned, false otherwise.
            return this.matchDirectoryPattern(directoryPath, directory, options.include) ? true : false;
        } else if (options.exclude) {
            //If the pattern is found; false is returned, true otherwise.
            return this.matchDirectoryPattern(directoryPath, directory, options.exclude) ? false : true;
        }
    }

    //////////////////////////////
    //////Patterns
    //////////////////////////////
    /**
     * Matches the file with pattern in options.
     * 
     * @param file the file.
     * @param options the pattern options.
     * 
     * @returns true if the pattern matches, undefined otherwise.
     */
    private static matchFilePattern(file: string, options: FilePattern) {
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

    /**
     * Matches the directory with pattern in options.
     * 
     * @param directoryPath the path of the directory.
     * @param directory the directory.
     * @param options the pattern options.
     * 
     * @returns true if the pattern matches, undefined otherwise.
     */
    private static matchDirectoryPattern(directoryPath: string, directory: string, options: DirectoryPattern) {
        if (options.match) {
            // //Remove trailing sep.
            // const matchs = options.match.split(path.sep).filter(Boolean);
            // if(directory === matchs[0]){
            //     console.log('if', directory);
            //     return true;
            // }else{
            //     console.log('else', directory);
            // }
            return true;
        }
    }
}

//////////////////////////////
//////Find
//////////////////////////////
/**
 * Interface for file/directory find options.
 */
export interface Find {
    /**
     * The optional, files to search.
     */
    files?: Filter<FilePattern>;

    /**
     * The optional, directories to search.
     */
    directories?: Filter<DirectoryPattern>;
}

//////////////////////////////
//////Filter
//////////////////////////////
/**
 * Interface for filtering the `Pattern`.
 */
export interface Filter<F extends Pattern> {
    /**
     * The optional, patterns to include.
     */
    include?: F;

    /**
     * The optional, patterns to exclude.
     */
    exclude?: F;
}

//////////////////////////////
//////Pattern
//////////////////////////////
/**
 * Type for matching files/directories.
 * 
 * @type `FilePattern` to match files.
 * @type `DirectoryPattern` to match directories.
 */
export type Pattern = FilePattern | DirectoryPattern;

/**
 * Interface for matching files.
 */
export interface FilePattern {
    /**
     * The optional, file that starts with.
     */
    startsWith?: Array<string>;

    /**
     * The optional, file that ends with.
     */
    endsWith?: Array<string>;

    /**
     * The optional, file that is like.
     */
    likeName?: Array<string>;

    /**
     * The optional, file that has extension.
     */
    extension?: Array<string>;
}

/**
 * Interface for matching directories.
 */
export interface DirectoryPattern {
    /**
     * Match the exact path.
     */
    match: string;
}