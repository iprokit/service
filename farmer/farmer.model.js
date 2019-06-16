class FarmerModel{
    findById(id){
        return new Promise((resolve, reject) => {
            resolve({id: id})
        });
    }
}

export default FarmerModel;