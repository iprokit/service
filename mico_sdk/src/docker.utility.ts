//Import modules
import ip from 'ip';

export default class DockerUtility{
    static getContainerIP(){
        return ip.address();
    }
    static getHostIP(){
        return ''; //TODO: This should become dynamic
    }
}