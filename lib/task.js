"use strict";

var Promise = require("bluebird");
var INITIAL = 0;
var PENDING= 1;
var DONE = 2;
var modelCache = {};
var mongoose;
var Schema;
var TaskMdl;
var DEFAULT_SCHEMA;


var TaskProvider = function (_mongoose, _TaskMdl) {
  mongoose = _mongoose;
  Schema = _mongoose.Schema;
  mongoose.Promise = Promise;
  TaskMdl = _TaskMdl;
  DEFAULT_SCHEMA = new Schema({}, {strict: false});

  return Task;
};

var Task = function(){
  var task = this;
  var index = 0;
  var steps = [];

  task.getTaskCollection = function(){
    return TaskMdl;
  };

  task.initModel = function(modelName, schema){
    if(!(modelName && schema)) throw new Error("Missing Args: modelName, Schema, or both");
    if(modelCache[modelName]) throw new Error("The schema for this model has already been set");
    if(!isObject(schema)) throw new Error("Invalid Schema");

    setModel(modelName, new Schema(schema, {strict: true}));

    return task;
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
      index: index
      , type: "update"
      , state: INITIAL
      , name: getModelName(model)
      , condition: condition
      , data: data
    };

    steps.push(updateObj);
    index++;

    return task;
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
      index: index
      , type: "save"
      , state: INITIAL
      , name: getModelName(model)
      , data: JSON.parse(JSON.stringify(doc))
    };

    steps.push(saveObj);
    index++;

    return task;
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
      index: index
      , type: "remove"
      , state: INITIAL
      , name: getModelName(model)
      , condition: condition
    };

    steps.push(removeObj);
    index++;

    return task;
  };

  task.options = function(options){
    if(!steps.length) throw new Error("Can't set options on non-existing task");
    if(!isObject(options)) throw new Error("Invalid Options");

    var obj = steps[steps.length - 1];

    if(obj.type !== "update"){
      throw new Error("the " + obj.type + " function does not accept options");
    }

    obj.options = options;
    return task
  };

  task.run = function(){
    var chain = Promise.resolve();
    var dbTask = new TaskMdl({steps: steps});
    steps = [];
    index = 0;

    return dbTask
      .save()
      .then(function(_task){
        _task.steps.forEach(function(step){
          chain = chain.then(function(){
            return getResolveFunc(step)(step, _task);
          });
        });

        return chain;
      });
  };
};

function getResolveFunc(step){
  switch(step.type){
    case "update": return performUpdate;
    case "save": return performSave;
    case "remove": return performRemove;
  }
}

function performUpdate(update, task) {
  var Collection = getModel(update.name);

  return storeOldData(update, task)
    .then(function(){
      return updateState(task, update.index, PENDING)
        .then(function(_task){
          return Collection.update(update.condition, update.data, update.options)
            .exec()
            .then(function(){
              return updateState(_task, update.index, DONE);
            });
        });
    });
}

//todo: store id of saved doc
function performSave(save, task){
  var Collection = getModel(save.name);
  var doc = new Collection(save.data);

  return updateState(task, save.index, PENDING)
    .then(function(_task){
      return doc.save()
        .then(function(){
          return updateState(_task, save.index, DONE);
        });
    });
}

function performRemove(remove, task){
  var Collection = getModel(remove.name);

  return storeOldData(remove, task)
    .then(function(){
      return updateState(task, remove.index, PENDING)
        .then(function(_task){
          return Collection.remove(remove.condition)
            .exec()
            .then(function(){
              return updateState(_task, remove.index, DONE)
            });
        });
    });
}

function storeOldData(step, task){
  var Collection = getModel(step.name);
  var options = step.options || step.type === "remove" ? {multi: true} : null;
  var query = Collection.find(step.condition);
  var searchQuery = options && options.multi === true
    ? query
    : query.limit(1);

  return searchQuery
    .exec()
    .then(function(result) {
      var oldData = [];

      for (var i = 0; i < result.length; i++) {
        oldData.push(result[i]._doc);
      }

      task.steps[step.index].oldData = oldData;
      task.steps[step.index].markModified("oldData");
    });
}

function updateState(task, index, state){
  task.steps[index].state = state;
  return task.save();
}

function getCollection(name, schema){
  return mongoose.model(name, schema || DEFAULT_SCHEMA, name);
}

function setModel(name, schema){
  modelCache[name] = getCollection(name, schema);
}

function getModel(name, schema){
  if(modelCache[name]) return modelCache[name];

  setModel(name, schema);
  return modelCache[name];
}

// These prototype functions be for testing purposes. Or not. I do what I want.
Task.prototype.getCollection = getModel;

Task.prototype.dropCollection = function(collection){
  return new Promise(function(resolve, reject){
    mongoose.connection.db.dropCollection(collection, function(err) {
      if(err) reject(err);
      else resolve();
    });
  });
};

function validModel(model){
  if(typeof model === "string") return true;

  return typeof model === "function" && model.modelName;
}

function validDoc(doc){
  return doc && doc._doc && doc.constructor && doc.constructor.modelName
}

function isObject(obj){
  return obj && typeof obj === "object";
}

function getModelName(model){
  return typeof model === "string" ? model : model.modelName;
}

module.exports = TaskProvider;