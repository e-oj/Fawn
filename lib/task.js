var Promise = require("bluebird");
var mongoose;
var TaskMdl;

var TaskProvider = function (_mongoose, _TaskMdl) {
  mongoose = _mongoose;
  TaskMdl = _TaskMdl;

  return Task;
};

var Task = function(){
  var task = this;
  var index = 0;

  var steps = [];

  task.update = function(model, condition, data){
    if(!(model && condition)) throw new Error("Missing args: model and condition are required");

    if(!data){
      data = condition;
      condition = {_id: model._id};
      model = model.constructor;
    }

    var updateObj = {
      _id: mongoose.Types.ObjectId()
      , index: index
      ,type: "update"
      , state: "initial"
      , name: model.modelName
      , condition: condition
      , data: data
    };

    steps.push(updateObj);
    index++;
  };

  task.save = function(doc){
    if(!doc) throw new Error("Missing args: you must provide a valid mongoose document");
    if(typeof doc !== "object") throw new Error("Invalid args: doc must be of type 'object'");
    if(!(doc._id && doc.constructor && doc.constructor.modelName))
      throw new Error("Invalid args: the provided doc not a valid mongoose document");

    var model = doc.constructor;

    var saveObj = {
      _id: mongoose.Types.ObjectId()
      , index: index
      ,type: "save"
      , state: "initial"
      , name: model.modelName
      , data: JSON.parse(JSON.stringify(doc))
    };

    steps.push(saveObj);
    index++;
  };

  task.remove = function(model, condition){
    if(!model) throw new Error("Missing args: model is required");
    if(typeof model !== "object") throw new Error("Invalid args: model must be of type 'object'");
    if(!condition){
      if(!(model._id && model.constructor && model.constructor.modelName))
        throw new Error("Invalid args: the provided doc not a valid mongoose document");

      condition = {_id: model._id};
      model = model.constructor;
    }
    if(typeof condition !== "object") throw new Error("Invalid args: condition must be of type 'object'");

    var removeObj = {
      _id: mongoose.Types.ObjectId()
      , index: index
      ,type: "remove"
      , state: "initial"
      , name: model.modelName
      , condition: condition
    };

    steps.push(removeObj);
    index++;
  };

  task.run = function(){
    return new Promise(function(resolve, reject){
      var chain = [];
      var execute;
      var dbTask = new TaskMdl({steps: steps});

      dbTask
        .save()
        .then(function(_task){
          steps = _task.steps;

          steps.forEach(function(step){
            execute = getResolveFunc(step);
            chain.push(execute(step, _task));
          });

          Promise.all(chain)
            .then(function(){
              resolve("done");
            })
            .catch(function(err){
              reject(err);
            });
        })
        .catch(function(err){
          reject(err);
        });
    });
  };
};

var getResolveFunc = function(step){
  switch(step.type){
    case "update": return performUpdate;
    case "save": return performSave;
  }
};

var performUpdate = function(update, task) {
  return new Promise(function (resolve, reject) {
    var Collection = getCollection(update.name);

    updateState(task, update.index, "pending")
      .then(function(_task){
        Collection.update(update.condition, update.data)
          .then(function(mongoRes){
            updateState(_task, update.index, "done")
              .then(function(){
                resolve(mongoRes);
              })
              .catch(function(err){
                reject(err);
              });
          })
          .catch(function(err){
            reject(err);
          });
      })
      .catch(function(err){
        reject(err);
      });
  });
};

var performSave = function(save, task){
  return new Promise(function(resolve, reject){
    var Collection = getCollection(save.name);
    var doc = new Collection(save.data);

    updateState(task, save.index, "pending")
      .then(function(_task){
        doc.save()
          .then(function(doc){
            updateState(_task, save.index, "done")
              .then(function(){
                resolve(doc);
              })
              .catch(function(err){
                reject(err);
              });
          })
          .catch(function(err){
            reject(err);
          });
      });
  });
};

var performRemove = function(remove, task){
  return new Promise(function(resolve, reject){
    
  });
};

var getCollection = function(name){
  return mongoose.model("blah", new Schema(), name);
};

var updateState = function(task, index, state){
    task.steps[index].state = state;
    return task.save();
};

module.exports = TaskProvider;