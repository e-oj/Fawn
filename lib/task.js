"use strict";

var Promise = require("bluebird");
var Grid = require("gridfs-stream");
var fs = require("fs");

var constants = require("./constants");
var utils = require("./utils/gen.utils");
var native = require("./task_core/native"); //set db utils when we get them
var goose = require("./task_core/goose");

// general utility functions
var validModel = utils.validModel;
var validDoc = utils.validDoc;
var getModelName = utils.getModelName;
var xcode = utils.xcode;
var resolveFuture = utils.resolveFuture;
var isObject = utils.isObject;
var updateState = utils.updateState;

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
var dbUtils;
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
  dbUtils = require("./utils/db.utils")(mongoose);
  native.setDbUtils(dbUtils);
  modelCache = dbUtils.modelCache;
  setModel = dbUtils.setModel;
  getModel = dbUtils.getModel;

  goose.setDbUtils(dbUtils);

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
var Task = function() {
  var task = this;
  var index = 0;
  var steps = [];

  /**
   * Mainly used internally for tests.
   *
   * @returns {TaskMdl} the mongoose model for the tasks
   */
  task.getTaskCollection = function() {
    return TaskMdl;
  };

  /**
   * @see dbUtils.initModel
   *
   * @param modelName The intended name of the model
   * @param schema The schema associated with this model
   * @returns {Task}
   */
  task.initModel = function(modelName, schema) {
    dbUtils.initModel(modelName, schema);

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
  task.update = function(model, condition, data) {
    if (!data) {
      if (!validDoc(model)) throw new Error("Invalid doc");

      data = condition;
      condition = {_id: model._id};
      model = model.constructor;
    }
    if (!validModel(model)) throw new Error("Invalid model");
    if (!isObject(condition)) throw new Error("Invalid Condition");
    if (!isObject(data)) throw new Error("Invalid data");

    var updateObj = {
      index: index
      , type: UPDATE
      , state: INITIAL
      , name: getModelName(model)
      , condition: xcode(condition)
      , data: xcode(data)
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
  task.save = function(model, doc) {
    if (!doc) {
      if (!validDoc(model)) throw new Error("Invalid doc");

      doc = model.toObject();
      model = model.constructor;
    }
    else if (validDoc(doc)) doc = doc.toObject();

    if (!validModel(model)) throw new Error("Invalid Model");
    if (!isObject(doc)) throw new Error("Invalid doc");

    var saveObj = {
      index: index
      , type: SAVE
      , state: INITIAL
      , name: getModelName(model)
      , data: xcode(doc)
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
  task.remove = function(model, condition) {
    if (!condition) {
      if (!validDoc(model)) throw new Error("Invalid doc");

      condition = {_id: model._id};
      model = model.constructor;
    }
    if (!validModel(model)) throw new Error("Invalid Model");
    if (!isObject(condition)) throw new Error("Invalid Condition");

    var removeObj = {
      index: index
      , type: REMOVE
      , state: INITIAL
      , name: getModelName(model)
      , condition: xcode(condition)
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
  task.options = function(options) {
    if (!steps.length) throw new Error("Can't set options on non-existing task");
    if (!isObject(options)) throw new Error("Invalid Options");

    var obj = steps[steps.length - 1];

    if (obj.type !== UPDATE) {
      throw new Error("the " + obj.type + " function does not accept options");
    }

    obj.options = options;
    return task;
  };

  /**
   * Adds a saveFile step (saveFileObj) to the steps queue
   * and increments the index.
   *
   * @param filePath path of the file to be saved
   * @param options options for saving  the file
   *
   * @returns {Task}
   */
  task.saveFile = function (filePath, options) {
    if (!filePath) throw new Error("File path is required and must be a string");
    if (options && !isObject(options)) throw new Error("options must be an object");

    var saveFileObj = {
      type: FILE_SAVE
      , index: index
      , state: INITIAL
      , data: {
        file_path: filePath
      }
      , options: xcode(options)
    };

    steps.push(saveFileObj);
    index++;

    return task;
  };

  /**
   * Adds a removeFile step (removeFileObj) to the steps queue
   * and increments the index.
   *
   * @param options options for removing  the file
   *
   * @returns {Task}
   */
  task.removeFile = function (options) {
    if (!isObject(options)) throw new Error("options required. Must be an object");

    var removeFileObj = {
      type: FILE_REMOVE
      , index: index
      , state: INITIAL
      , options: xcode(options)
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
   * @options options to run with
   *
   * @returns a promise
   */
  task.run = function(options){
    var chain = Promise.resolve();
    var dbTask = new TaskMdl({steps: steps});
    steps = [];
    index = 0;
    var results = [];

    return dbTask.save().then(function (_task) {
      _task.steps.forEach(function (step) {
        chain = chain.then(function () {
          if(options) step.useMongoose = options.useMongoose;

          return getResolveFunc(step)(step, _task, results);
        });
      });

      return chain.then(function () {
        var gfs = Grid(mongoose.connection.db);
        var removeChain = dbUtils.makeRemoveChain(_task, gfs);

        return removeChain.then(function () {
          return _task.constructor.collection.deleteOne({_id: _task._id})
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
function getResolveFunc(step) {
  switch(step.type){
    case UPDATE: return performUpdate;
    case SAVE: return performSave;
    case REMOVE: return performRemove;
    case FILE_SAVE: return performFileSave;
    case FILE_REMOVE: return performFileRemove;
  }
}

/**
 * This function handles the update step.
 *
 * @param step the update step
 * @param task the task which step belongs to
 * @param results array of results from previous operations
 *
 * @returns {Promise|*}
 */
function performUpdate(step, task, results) {
  var db = mongoose.connection.db;

  return step.useMongoose
    ? goose.performUpdate(db, step, task, results)
    : native.nativeUpdate(db, step, task, results)
}

/**
 * This function handles the save step.
 *
 * @param step the save step
 * @param task the task which step belongs to
 * @param results array of results from previous operations
 *
 * @returns {Promise|*}
 */
function performSave(step, task, results) {
  var db = mongoose.connection.db;

  return step.useMongoose
    ? goose.performSave(step, task, results)
    : native.nativeSave(db, step, task, results)
}

/**
 * This function handles the remove step.
 *
 * @param step the remove step
 * @param task the task which step belongs to
 * @param results array of results from previous operations
 *
 * @returns {Promise|*}
 */
function performRemove(step, task, results) {
  var db = mongoose.connection.db;

  return step.useMongoose
    ? goose.performRemove(db, step, task, results)
    : native.nativeRemove(db, step, task, results)
}

/**
 * This function handles the file save step.
 *
 * @param step the file save step
 * @param task the task which step belongs to
 * @param results array of results from previous operations
 *
 * @returns {Promise|*}
 */
function performFileSave(step, task, results) {
  var options = step.options ? xcode(step.options, true) : {};

  resolveFuture(options, results);
  options._id = options._id || dbUtils.generateId();

  step.options = options;
  step.dataStore = [{_id: options._id}];

  return updateState(task, step.index, PENDING).then(function () {
    return new Promise(function (resolve, reject) {
      var conn = mongoose.connection;
      var gfs = Grid(conn.db);
      var writeStream = gfs.createWriteStream(options);

      writeStream.on("close", function (file) {
        results.push(file);

        resolve(results);
      });

      writeStream.on("error", reject);

      fs.createReadStream(step.data.file_path).pipe(writeStream);

    }).then(function (results) {
      return updateState(task, step.index, DONE, results);
    });
  });
}

/**
 * This function handles the file remove step.
 *
 * @param step the file remove step
 * @param task the task which step belongs to
 * @param results array of results from previous operations
 *
 * @returns {Promise|*}
 */
function performFileRemove(step, task, results) {
  var options = xcode(step.options, true);

  resolveFuture(options, results);

  return storeOldFile(task, step).then(function (file) {
    return updateState(task, step.index, PENDING).then(function () {
      var chain = Promise.resolve();

      if (!file) {
        results.push(null);
      }
      else{
        var gfs = Grid(mongoose.connection.db);

        chain = dbUtils.removeFile(options, gfs).then(function (result) {
          results.push(result);
        });
      }

      return chain.then(function () {
        return updateState(task, step.index, DONE, results);
      });
    });
  });
}

/**
 * This function stores a file that's about to be
 * removed by a step, for rollback purposes
 *
 * @param task the task
 * @param step the step
 *
 * @returns {Promise|*}
 */
function storeOldFile(task, step) {
  return new Promise(function (resolve, reject) {
    var gfs = Grid(mongoose.connection.db);
    var options = xcode(step.options, true);

    gfs.findOne(options, function (err, file) {
      if (err) return reject(err);
      if (!file) return resolve(false);

      var collection = task.constructor.collection;
      step.dataStore = [{removed: file._id, shadow: dbUtils.generateId()}];

      collection.updateOne({_id: task._id}, task.toObject()).then(function(){
        var writeStream = gfs.createWriteStream({
          _id: step.dataStore[0].shadow,
          metadata: {oldFile: file}
        });

        writeStream.on("close", resolve);
        writeStream.on("error", reject);

        gfs.createReadStream({_id: file._id}).pipe(writeStream);
      });
    });
  });
}

module.exports = TaskProvider;