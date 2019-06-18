import ip from 'ip';

class DockerUtility{
    getContainerIP(){
        return ip.address();
    }
    getHostIP(){
        return '13.126.182.141'; //This should become dynamic
    }
}

export default DockerUtility;