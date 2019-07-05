import ip from 'ip';

export default class DockerUtility{
    static getContainerIP(){
        return ip.address();
    }
    static getHostIP(){
        return '13.126.182.141'; //This should become dynamic
    }
}