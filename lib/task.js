"use strict";

var Promise = require("bluebird");
var Grid = require("gridfs-stream");
var fs = require("fs");

var constants = require("./constants");

// didn't want to type "constants." every time
var INITIAL = constants.INITIAL;
var PENDING= constants.PENDING;
var DONE = constants.DONE;
var SAVE = constants.SAVE;
var UPDATE = constants.UPDATE;
var REMOVE = constants.REMOVE;
var FILE_SAVE = constants.FILE_SAVE;
var FILE_REMOVE = constants.FILE_REMOVE;

// variables which require a mongoose instance
var mongoose;
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
 * @param _mongoose The mongoose instance to be used
 * @param _TaskMdl The mongoose model for tasks (where tasks are stored)
 * @returns {Task}
 *
 * @constructor
 */
var TaskProvider = function (_mongoose, _TaskMdl) {
  mongoose = _mongoose;
  Grid.mongo = mongoose.mongo;
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

    handle$Token(doc);

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

  task.saveFile = function (filePath, options) {
    if (!filePath) throw new Error("File path is required and must be a string");
    if (options) {
      if (!isObject(options)) throw new Error("options must be an object");
      handle$Token(options);
    }

    var saveFileObj = {
      type: FILE_SAVE
      , index: index
      , state: INITIAL
      , data: {
        file_path: filePath
      }
      , options: options
    };

    steps.push(saveFileObj);
    index++;

    return task;
  };

  task.removeFile = function (options) {
    if (!isObject(options)) throw new Error("options required. Must be an object");

    handle$Token(options);

    var removeFileObj = {
      type: FILE_REMOVE
      , index: index
      , state: INITIAL
      , options: options
    };

    steps.push(removeFileObj);
    index++;

    return task;
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
        var gfs = Grid(mongoose.connection.db);
        var removeChain = utils.makeRemoveChain(_task, gfs);

        return removeChain.then(function () {
          return _task.remove()
            .then(function () {
              return Promise.resolve(results);
            });
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
    case FILE_SAVE:
      return performFileSave;
    case FILE_REMOVE:
      return performFileRemove
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

  resolveFuture(update.condition, results);
  resolveFuture(update.data, results);

  // console.log(update);
  return storeOldData(update)
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

  handle$Token(save.data, true);
  resolveFuture(save.data, results);

  var doc = new Collection(save.data);
  var dataStore = [];

  doc._id = doc._id || utils.generateId();
  dataStore.push({_id: doc._id});

  save.dataStore = dataStore;
  save.markModified("dataStore");

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
  resolveFuture(remove.condition, results);

  return storeOldData(remove).then(function () {
    return updateState(task, remove.index, PENDING).then(function () {
      return Collection.remove(remove.condition).exec().then(function (result) {
        results.push(result);

        return updateState(task, remove.index, DONE, results);
      });
    });
  });
}

function performFileSave(fileSave, task, results) {
  handle$Token(fileSave.options, true);
  resolveFuture(fileSave.options, results);

  var options = fileSave.options || {};
  var dataStore = [];

  options._id = options._id || utils.generateId();
  dataStore.push({_id: options._id});

  fileSave.options = options;
  fileSave.dataStore = dataStore;

  fileSave.markModified("dataStore");
  fileSave.markModified("options");

  return updateState(task, fileSave.index, PENDING).then(function () {
    return new Promise(function (resolve, reject) {
      var conn = mongoose.connection;
      var gfs = Grid(conn.db);
      var writeStream = gfs.createWriteStream(options);

      writeStream.on("close", function (file) {
        results.push(file);

        resolve(results);
      });

      writeStream.on("error", reject);

      fs.createReadStream(fileSave.data.file_path).pipe(writeStream);

    }).then(function (results) {
      return updateState(task, fileSave.index, DONE, results);
    });
  });
}

function performFileRemove(fileRemove, task, results) {
  handle$Token(fileRemove.options, true);
  resolveFuture(fileRemove.options, results);

  var options = fileRemove.options;

  return storeOldFile(fileRemove).then(function (file) {
    return updateState(task, fileRemove.index, PENDING).then(function () {
      return new Promise(function (resolve, reject) {
        if (!file) {
          results.push(null);
          return resolve();
        }

        var gfs = Grid(mongoose.connection.db);

        utils.removeFile(options, gfs)
          .then(function (result) {
            results.push(result);
            resolve();
          })
          .catch(reject);

      }).then(function () {
        return updateState(task, fileRemove.index, DONE, results);
      });
    });
  });
}

function storeOldFile(fileRemove) {
  return new Promise(function (resolve, reject) {
    var dataStore = [];
    var gfs = Grid(mongoose.connection.db);

    gfs.findOne(fileRemove.options, function (err, file) {
      if (err) return reject(err);
      if (!file) return resolve(false);

      dataStore.push({removed: file._id, shadow: utils.generateId()});
      fileRemove.dataStore = dataStore;

      fileRemove.save().then(function () {
        var writeStream = gfs.createWriteStream({_id: dataStore[0].shadow, metadata: {oldFile: file}});

        writeStream.on("close", resolve);
        writeStream.on("error", reject);

        gfs.createReadStream({_id: file._id}).pipe(writeStream);
      });
    });
  });
}

/**
 * This function stores data that's about to be
 * changed by a step, for rollback purposes
 *
 * @param step the step
 *
 * @returns {Promise|*}
 */
function storeOldData(step) {
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

      step.dataStore = oldData;
      step.markModified("dataStore");
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

/**
 * Replaces a placeholder with real data.
 *
 * e.g:
 *  var testResults = [{name: "Bob"}]
 *  var testObj = {name: {$ojFuture: "0.name"}}
 *
 *  resolveFuture(testObj, testResults);
 *
 *  console.log(testObj) // {name: "Bob"}
 *
 * @param obj Object that might contain templated data
 * @param results results used to replace templated data
 */
function resolveFuture(obj, results) {
  var ojf = constants.OJ_FUTURE;

  Object.keys(obj).forEach(function (key) {
    if (!isObject(obj[key])) return;
    if (!obj[key][ojf]) return resolveFuture(obj[key], results);

    var placeholder = obj[key][ojf];

    // format: "index.property.property.-----.property"
    var parts = placeholder.split(".");
    if (isNaN(parts[0])) throw new Error("step index must be a number");

    var index = parseInt(parts[0]);
    if (index >= results.length) throw new Error("Invalid index. The result at that index does not exist (yet)");

    var result = results[index];

    for (var i = 1; i < parts.length; i++) {
      if (result.toObject) result = result.toObject();

      if (result instanceof Array) {
        if (isNaN(parts[i])) throw new Error("Array index must be a number");
        parts[i] = parseInt(parts[i]);

        if (parts[i] >= result.length)throw new Error("Array index out of bounds");
      }
      else if (!isObject(result))throw new Error("Can't use keys on non-object");

      if (!result[parts[i]]) throw new Error("No such key exists in result");
      result = result[parts[i]]
    }

    obj[key] = result;
  });
}

module.exports = TaskProvider;
