var Promise = require("bluebird");
var mongoose;
var Schema;
var TaskMdl;
var INITIAL = 0;
var PENDING= 1;
var DONE = 2;
var defaultSchema;


var TaskProvider = function (_mongoose, _TaskMdl) {
  mongoose = _mongoose;
  Schema = _mongoose.Schema;
  mongoose.Promise = Promise;
  TaskMdl = _TaskMdl;
  defaultSchema = new Schema({}, {strict: false});

  return Task;
};

var Task = function(){
  var task = this;
  var index = 0;
  var isDead = false;

  var steps = [];

  task.getTaskCollection = function(){
    return TaskMdl;
  };

  task.update = function(model, condition, data){
    if(!data){
      if(!validDoc(model)) throw new Error("Invalid doc");

      data = condition;
      condition = {_id: model._id};
      model = model.constructor;
    }
    if(!validModel(model)) throw new Error("Invalid model");
    if(!isObject(condition)) throw new Error("Invalid Condition");
    if(!isObject(data)) throw new Error("Invalid data");

    var updateObj = {
      _id: mongoose.Types.ObjectId()
      , index: index
      , type: "update"
      , state: INITIAL
      , name: getModel(model)
      , condition: condition
      , data: data
    };

    steps.push(updateObj);
    index++;
  };

  task.save = function(model, doc){
    if(!doc){
      if(!validDoc(model)) throw new Error("Invalid doc");

      doc = model;
      model = model.constructor;
    }
    if(!validModel(model)) throw new Error("Invalid Model");
    if(!isObject(doc)) throw new Error("Invalid doc");

    var saveObj = {
      _id: mongoose.Types.ObjectId()
      , index: index
      , type: "save"
      , state: INITIAL
      , name: getModel(model)
      , data: JSON.parse(JSON.stringify(doc))
    };

    steps.push(saveObj);
    index++;
  };

  task.remove = function(model, condition){
    if(!condition){
      if(!validDoc(model)) throw new Error("Invalid doc");

      condition = {_id: model._id};
      model = model.constructor;
    }
    if(!validModel(model)) throw new Error("Invalid Model");
    if(!isObject(condition)) throw new Error("Invalid Condition");

    var removeObj = {
      _id: mongoose.Types.ObjectId()
      , index: index
      , type: "remove"
      , state: INITIAL
      , name: getModel(model)
      , condition: condition
    };

    steps.push(removeObj);
    index++;
  };

  task.run = function(){
    if(isDead) throw new Error("A task, much like condoms, cannot be reused. Create a new task");

    isDead = true;

    return new Promise(function(resolve, reject){
      var chain = Promise.resolve();
      var execute;
      var dbTask = new TaskMdl({steps: steps});

      dbTask
        .save()
        .then(function(_task){
          _task.steps.forEach(function(step){
            execute = getResolveFunc(step);

            chain = chain.then(function(){
              return execute(step, _task)
            });
          });

          chain
            .then(function(){
              dbTask.remove()
                .then(resolve)
                .catch(reject)
            })
            .catch(reject);
        })
        .catch(reject);
    });
  };
};

var getResolveFunc = function(step){
  switch(step.type){
    case "update": return performUpdate;
    case "save": return performSave;
    case "remove": return performRemove;
  }
};

var performUpdate = function(update, task) {
  return new Promise(function (resolve, reject) {
    var Collection = getCollection(update.name);

    updateState(task, update.index, PENDING)
      .then(function(_task){
        Collection.update(update.condition, update.data)
          .then(function(mongoRes){
            updateState(_task, update.index, DONE)
              .then(function(){
                resolve(mongoRes);
              })
              .catch(reject);
          })
          .catch(reject);
      })
      .catch(reject);
  });
};

var performSave = function(save, task){
  return new Promise(function(resolve, reject){
    var Collection = getCollection(save.name);
    var doc = new Collection(save.data);

    updateState(task, save.index, PENDING)
      .then(function(_task){
        doc.save()
          .then(function(doc){
            updateState(_task, save.index, DONE)
              .then(function(){
                resolve(doc);
              })
              .catch(reject);
          })
          .catch(reject);
      });
  });
};

var performRemove = function(remove, task){
  return new Promise(function(resolve, reject){
    var Collection = getCollection(remove.name);

    updateState(task, remove.index, PENDING)
      .then(function(_task){
        Collection.remove(remove.condition)
          .then(function(){
            updateState(_task, remove.index, DONE)
              .then(function(){
                resolve("removed");
              })
              .catch(reject);
          })
          .catch(reject);
      })
      .catch(reject);
  });
};

var getCollection = function(name){
  return mongoose.model(null, defaultSchema, name);
};

Task.prototype.getCollection = getCollection;

Task.prototype.dropCollection = function(collection){
  return new Promise(function(resolve, reject){
    mongoose.connection.db.dropCollection(collection, function(err) {
      if(err) reject(err);
      else resolve();
    });
  });
};

var updateState = function(task, index, state){
  task.steps[index].state = state;
  return task.save();
};

var validModel = function(model){
  if(typeof model === "string") return true;

  try {
    return typeof model === "function" && model.modelName;
  } catch (err){
    return false;
  }
};

var validDoc = function(doc){
  try {
    return doc._id && doc.constructor && doc.constructor.modelName
  } catch (err){
    return false;
  }
};

var isObject = function(obj){
  return obj && typeof obj === "object";
};

var getModel = function(model){
  return typeof model === "string" ? model : model.modelName;
};

module.exports = TaskProvider;