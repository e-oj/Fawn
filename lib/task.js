"use strict";

var mongoose = require("mongoose");
var Promise = require("bluebird");
var constants = require("./constants");

var Schema = mongoose.Schema;
var INITIAL = constants.INITIAL;
var PENDING= constants.PENDING;
var DONE = constants.DONE;
var SAVE = constants.SAVE;
var UPDATE = constants.UPDATE;
var REMOVE = constants.REMOVE;
var utils;
var updateState;
var modelCache;
var setModel;
var getModel;
var TaskMdl;
var Roller;

var TaskProvider = function (mongoose, _TaskMdl) {
  TaskMdl = _TaskMdl;
  Roller = require("./roller")(mongoose, _TaskMdl);
  utils = require("./utils")(mongoose);
  updateState = utils.updateState;
  modelCache = utils.modelCache;
  setModel = utils.setModel;
  getModel = utils.getModel;


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

    handle$Token(condition);
    handle$Token(data);

    var updateObj = {
      index: index
      , type: UPDATE
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
      , type: SAVE
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

    handle$Token(condition);

    var removeObj = {
      index: index
      , type: REMOVE
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

    if(obj.type !== UPDATE){
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

        return chain
          .then(function(){
            return _task.remove();
          })
          .catch(function(err){
            return Roller.roll()
              .then(function(){
                throw err;
              });
          });
      });
  };
};

function getResolveFunc(step){
  switch(step.type){
    case UPDATE: return performUpdate;
    case SAVE: return performSave;
    case REMOVE: return performRemove;
  }
}

function performUpdate(update, task) {
  var Collection = getModel(update.name);

  handle$Token(update.condition, true);
  handle$Token(update.data, true);

  // console.log(update);
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
  var dataStore = [];

  doc._id = doc._id || utils.generateId();
  dataStore.push({_id: doc._id});

  task.steps[save.index].dataStore = dataStore;
  task.steps[save.index].markModified("dataStore");

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

  handle$Token(remove.condition, true);

  return storeOldData(remove, task)
    .then(function(){
      return updateState(task, remove.index, PENDING)
        .then(function(_task){
          return Collection.remove(remove.condition)
            .exec()
            .then(function(){
              return updateState(_task, remove.index, DONE);
            });
        });
    });
}

function storeOldData(step, task){
  var Collection = getModel(step.name);
  var options = step.options || step.type === REMOVE ? {multi: true} : null;
  var query = Collection.find(step.condition);
  var searchQuery = options && options.multi === true
    ? query
    : query.limit(1);

  return searchQuery
    .exec()
    .then(function(result) {
      var oldData = [];

      for (var i = 0; i < result.length; i++) {
        oldData.push(result[i].toObject());
      }

      task.steps[step.index].dataStore = oldData;
      task.steps[step.index].markModified("dataStore");
    });
}

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

function handle$Token(obj, fix){
  var ESCAPE_PREFIX = constants.ESCAPE_PREFIX;
  var escapeLength = ESCAPE_PREFIX.length;
  var keys = Object.keys(obj);
  var key;
  var $key;

  for(var i = 0; i < keys.length; i++){
    key = keys[i];

    if(!fix && key[0] === "$"){
      obj[ESCAPE_PREFIX + key] = obj[key];
      delete obj[key];
    }

    if(fix && key.length >= escapeLength && key.substring(0, escapeLength) === ESCAPE_PREFIX){
      $key = key.replace(ESCAPE_PREFIX, "");
      obj[$key] = obj[key];
      delete obj[key];
    }
  }
}

module.exports = TaskProvider;
