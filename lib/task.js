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

      var update= {
        type: "update"
        , name: model.modelName
        , where: condition
        , with: data
      };

      task.steps.push(update);
    };

    task.save = function(document){

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
  }
};

var performUpdate = function(update) {
  return new Promise(function (resolve, reject) {
    var collection = mongoose.model("blah", new Schema(), update.name);

    collection.update(update.where, update.with, function (err, mongoRes) {
      if (err) reject(err);
      else resolve(mongoRes);
    });
  });
};

module.exports = Task;