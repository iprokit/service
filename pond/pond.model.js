class PondModel{
    findById(id){
        return new Promise((resolve, reject) => {
            resolve({id: id})
        });
    }
}

export default PondModel;