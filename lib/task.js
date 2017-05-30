"use strict";

var mongoose = require("mongoose");
var Promise = require("bluebird");
var constants = require("./constants");

// didn't want to type "constants." every time
var INITIAL = constants.INITIAL;
var PENDING= constants.PENDING;
var DONE = constants.DONE;
var SAVE = constants.SAVE;
var UPDATE = constants.UPDATE;
var REMOVE = constants.REMOVE;

// variables which require a mongoose instance
var utils;
var updateState;
var modelCache;
var setModel;
var getModel;
var TaskMdl;
var Roller;

/**
 * Provider for the Task class. It initializes all the
 * required variables and returns the Task class. Used
 * internally.
 *
 * @param mongoose The mongoose instance to be used
 * @param _TaskMdl The mongoose model for tasks (where tasks are stored)
 *
 * @returns {Task}
 *
 * @constructor
 */
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

/**
 * The task class. It contains all the functions associated
 * with a task. Enables edits to be queued as a series of
 * steps and run, in the order they were queued, in a
 * way that allows the edits to be rolled back in the event
 * of a failure.
 *
 * @constructor
 */
var Task = function(){
  var task = this;
  var index = 0;
  var steps = [];

  /**
   * Mainly used internally for tests.
   *
   * @returns {TaskMdl} the mongoose model for the tasks
   */
  task.getTaskCollection = function(){
    return TaskMdl;
  };

  /**
   * @see utils.initModel
   *
   * @param modelName The intended name of the model
   * @param schema The schema associated with this model
   * @returns {Task}
   */
  task.initModel = function(modelName, schema){
    utils.initModel(modelName, schema);

    return task;
  };

  /**
   * Adds an update step (updateObj) to the steps queue
   * and increments the index.
   *
   * @param model the model or document to update
   * @param condition the condition or data for this update
   * @param data the data for this update
   *
   * @returns {Task}
   */
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

  /**
   * Adds a save step (saveObj) to the steps queue
   * and increments the index.
   *
   * @param model the model we're saving to or document to save
   * @param doc the object to be saved
   *
   * @returns {Task}
   */
  task.save = function(model, doc){
    if(!doc){
      if(!validDoc(model)) throw new Error("Invalid doc");

      doc = model.toObject();
      model = model.constructor;
    }
    else if (validDoc(doc)) doc = doc.toObject();

    if(!validModel(model)) throw new Error("Invalid Model");
    if(!isObject(doc)) throw new Error("Invalid doc");

    var saveObj = {
      index: index
      , type: SAVE
      , state: INITIAL
      , name: getModelName(model)
      , data: doc
    };

    steps.push(saveObj);
    index++;

    return task;
  };

  /**
   * Adds a remove step (removeObj) to the steps queue
   * and increments the index.
   *
   * @param model the model we're removing from or document to remove
   * @param condition the condition for removal
   *
   * @returns {Task}
   */
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

  /**
   * Adds options to an update step.
   *
   * @param options the options to be added
   *
   * @returns {Task}
   */
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

  /**
   * Runs a task. This function saves the steps to
   * the db and proceeds to complete each step. If
   * any of the steps fail, all previously completed
   * steps get rolled back and the causal error is
   * returned through a promise
   *
   * @returns a promise
   */
  task.run = function(){
    var chain = Promise.resolve();
    var dbTask = new TaskMdl({steps: steps});
    steps = [];
    index = 0;
    var results = [];

    return dbTask.save().then(function (_task) {
      _task.steps.forEach(function (step) {
        chain = chain.then(function () {
          return getResolveFunc(step)(step, _task, results);
        });
      });

      return chain.then(function (results) {
        return _task.remove()
          .then(function () {
            return Promise.resolve(results);
          });
      }).catch(function (err) {
        return Roller.rollOne(_task).then(function () {
          throw err;
        });
      });
    });
  };
};

/**
 * The appropriate function to resolve a
 * step
 *
 * @param step the step to resolve
 *
 * @returns a function to handle the step
 */
function getResolveFunc(step){
  switch(step.type){
    case UPDATE: return performUpdate;
    case SAVE: return performSave;
    case REMOVE: return performRemove;
  }
}

/**
 * This function handles the update step.
 *
 * @param update the update step
 * @param task the task containing update
 * @param results array of results from previous operations
 *
 * @returns {Promise|*}
 */
function performUpdate(update, task, results) {
  var Collection = getModel(update.name);

  handle$Token(update.condition, true);
  handle$Token(update.data, true);

  // console.log(update);
  return storeOldData(update, task)
    .then(function(){
      return updateState(task, update.index, PENDING)
        .then(function () {
          return Collection.update(update.condition, update.data, update.options)
            .exec()
            .then(function (result) {
              results.push(result);

              return updateState(task, update.index, DONE, results);
            });
        });
    });
}


/**
 * This function handles the save step.
 *
 * @param save the save step
 * @param task the task containing save
 * @param results array of results from previous operations
 *
 * @returns {Promise|*}
 */
function performSave(save, task, results) {
  var Collection = getModel(save.name);
  var doc = new Collection(save.data);
  var dataStore = [];

  doc._id = doc._id || utils.generateId();
  dataStore.push({_id: doc._id});

  task.steps[save.index].dataStore = dataStore;
  task.steps[save.index].markModified("dataStore");

  return updateState(task, save.index, PENDING).then(function () {
    return doc.save().then(function (result) {
      results.push(result);

      return updateState(task, save.index, DONE, results);
    });
  });
}

/**
 * This function handles the remove step.
 *
 * @param remove the remove step
 * @param task the task containing remove
 * @param results array of results from previous operations
 *
 * @returns {Promise|*}
 */
function performRemove(remove, task, results) {
  var Collection = getModel(remove.name);

  handle$Token(remove.condition, true);

  return storeOldData(remove, task).then(function () {
    return updateState(task, remove.index, PENDING).then(function () {
      return Collection.remove(remove.condition).exec().then(function (result) {
        results.push(result);

        return updateState(task, remove.index, DONE, results);
      });
    });
  });
}

/**
 * This function stores data that's about to be
 * changed by a step, for rollback purposes
 *
 * @param step the step
 * @param task the task containing step
 *
 * @returns {Promise|*}
 */
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

/**
 * Loosely check that a mongoose model is valid
 *
 * @param model the model to check
 *
 * @returns {boolean}
 */
function validModel(model){
  if(typeof model === "string") return true;

  return typeof model === "function" && model.modelName;
}

/**
 * Loosely checks that a mongoose document is valid.
 *
 * @param doc the document to check
 *
 * @returns {boolean}
 */
function validDoc(doc){
  return doc && doc._doc && doc.constructor && doc.constructor.modelName
}

/**
 * Checks that an object is valid
 *    isObject({name: "Max Payne"}) = true
 *    isObject(new Array()) = false
 *    isObject(null) = false
 *
 * @param obj the object to validate
 *
 * @returns {boolean}
 */
function isObject(obj){
  return obj && obj.constructor && obj.constructor === Object;
}

/**
 * Gets the name of a model
 *
 * @param model the model
 *
 * @returns the model's name
 */
function getModelName(model){
  return typeof model === "string" ? model : model.modelName;
}

/**
 * Handles the "$" token in queries because
 * MongoDB does not allow object keys to start with
 * "$"
 *
 * @param obj the object in question
 * @param decode To decode or not to decode?
 */
function handle$Token(obj, decode) {
  var ESCAPE_PREFIX = constants.ESCAPE_PREFIX;
  var escapeLength = ESCAPE_PREFIX.length;
  var keys = Object.keys(obj);
  var key;
  var $key;

  for(var i = 0; i < keys.length; i++){
    key = keys[i];

    if(isObject(obj[key])){
      handle$Token(obj[key], decode);
    }

    if (!decode && key[0] === "$") {
      obj[ESCAPE_PREFIX + key] = obj[key];
      delete obj[key];
    }

    if (decode && key.length >= escapeLength && key.substring(0, escapeLength) === ESCAPE_PREFIX) {
      $key = key.replace(ESCAPE_PREFIX, "");
      obj[$key] = obj[key];
      delete obj[key];
    }
  }
}

module.exports = TaskProvider;
