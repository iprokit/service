import httpStatus from 'http-status-codes'

class Customer{
    selectOneByID(req, res){
        res.status(httpStatus.OK).send({ status: true, message: "selectOneByID" });
    }
    selectAll(req, res){
        res.status(httpStatus.OK).send({ status: true, message: "selectAll" });
    }
    add(req, res){
        res.status(httpStatus.OK).send({ status: true, message: "add" });
    }
    update(req, res){
        res.status(httpStatus.OK).send({ status: true, message: "update" });
    }
    deleteOneByID(req, res){
        res.status(httpStatus.OK).send({ status: true, message: "deleteOneByID" });
    }
}

export default Customer