//Import modules
import ip from 'ip';

export default class DockerUtility{
    public static getContainerIP(){
        return ip.address();
    }
    
    public static getHostIP(){
        return ''; //TODO: This should become dynamic
    }
}