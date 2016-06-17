var Promise = require("bluebird");
var mongoose;

var Task = function (_mongoose) {
  mongoose = _mongoose;

  return function(){
    var task = this;

    task.steps = [];

    task.update = function(model, condition, data){
      if(!(model && condition)) throw new Error("model and condition are required");

      if(!data){
        data = condition;
        condition = {_id: model._id};
        model = model.constructor;
      }

      task.steps.push({
        type: "update"
        , name: model.modelName
        , where: condition
        , with: data
      });
    };

    task.save = function(doc){
      if(!doc) throw new Error("Missing doc!!");
      if(typeof doc !== "object") throw new Error("Invalid args: doc must be of type 'object'");
      if(!doc.constructor.modelName) throw new Error("Invalid args: the provided doc is invalid");
      
      var model = doc.constructor;
      
      task.steps.push({
        type: "save"
        , name: model.modelName
        , data: JSON.parse(JSON.stringify(doc))
      });
    };

    task.remove = function(model, condition, data){

    };

    task.run = function(){
      var chain = Promise.resolve(null);
      var execute;
      
      task.steps.forEach(function(step){
        execute = getResolveFunc(step);

        chain = chain.then(function(){
          return execute(step);
        });
      });
    };
  };
};

var getResolveFunc = function(step){
  switch(step.type){
    case "update": return performUpdate;
    case "save": return performSave;
  }
};

var performUpdate = function(update) {
  return new Promise(function (resolve, reject) {
    var Collection = getCollection(update.name);

    Collection.update(update.where, update.with, function (err, mongoRes) {
      if (err) reject(err);
      else resolve(mongoRes);
    });
  });
};

var performSave = function(save){
  return new Promise(function(resolve, reject){
    var Collection = getCollection(save.name);
    var doc = new Collection(save.data);

    doc.save(function(err){
      if(err) reject(err);
      else resolve("saved");
    });
  });
};

var getCollection = function(name){
  return mongoose.model("blah", new Schema(), name);
};

module.exports = Task;