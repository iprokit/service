class Customers{
    findById(id){
        return new Promise((resolve, reject) => {
            resolve({number: id})
        });
    }
}

export default Customers