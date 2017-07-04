"use strict";

/**
 * @author EmmanuelOlaojo
 * @since 7/31/16
 */

var Promise = require("bluebird");
var constants = require("./constants");

var INITIAL = constants.INITIAL;
var DONE = constants.DONE;
var ROLLED = constants.ROLLED;
var SAVE = constants.SAVE;
var UPDATE = constants.UPDATE;
var REMOVE = constants.REMOVE;
var FILE_REMOVE = constants.FILE_REMOVE;
var FILE_SAVE = constants.FILE_SAVE;
var TaskMdl;
var utils;
var updateState;
var getModel;

/**
 * Initializes variables and gets the roller.
 *
 * @param mongoose the mongoose instance
 * @param _TaskMdl the task model
 *
 * @returns An object containing rollback functions
 * @constructor
 */
var RollerProvider = function(mongoose, _TaskMdl) {
  TaskMdl = _TaskMdl;
  utils = require("./utils")(mongoose);
  updateState = utils.updateState;
  getModel = utils.getModel;

  return Roller;
};

var Roller = {

  /**
   * rolls back all incomplete tasks
   */
  roll: function() {
    var chain = Promise.resolve();

    return TaskMdl.find().exec().then(function (tasks) {
      tasks.forEach(function (task) {
        chain = chain.then(function () {
          return rollBackTask(task);
        });
      });
      return chain;
    });
  }

  // for internal use only
  , rollOne: rollBackTask
};

/**
 * Rollback for a single task
 *
 * @param task the task to roll back
 *
 * @returns {Promise|*}
 */
function rollBackTask(task) {
  var chain = Promise.resolve();
  var lastIndex = task.steps.length - 1;
  var firstStep = task.steps[0];
  var lastStep = task.steps[lastIndex];
  var step;

  if (lastStep.state !== DONE && firstStep.state !== INITIAL) {
    for(var i = lastIndex; i >= 0 ; i--){
      step = task.steps[i];

      if (step.state === INITIAL || step.state === ROLLED) continue;

      //iife to avoid async issues
      (function(step){
        chain = chain.then(function() {
          return getRollbackFunc(step)(step, task);
        });
      })(step);
    }
  }

  return chain.then(function() {
    return task.remove();
  });
}

/**
 * Gets the correct rollback function for a step
 *
 * @param step the step to rollback
 *
 * @returns a function to rollback step
 */
function getRollbackFunc(step) {
  switch(step.type) {
    case SAVE: return rollbackSave;
    case UPDATE:
    case REMOVE: return rollbackRemoveOrUpdate;
    case FILE_SAVE: return rollbackFileSave;
    case FILE_REMOVE: return rollbackFileRemove;
  }
}

/**
 * Rollback for a save step
 *
 * @param save the save step
 * @param task the task containing the step
 *
 * @returns {Promise|*}
 */
function rollbackSave(save, task) {
  var Collection = getModel(save.name);

  return Collection.remove({_id: save.dataStore[0]._id}).exec().then(function () {
    return updateState(task, save.index, ROLLED);
  });
}

/**
 * Rollback for remove or update step.
 *
 * @param step the update or remove step
 * @param task the task containing the step.
 *
 * @returns {Promise|*}
 */
function rollbackRemoveOrUpdate(step, task) {
  var Collection = getModel(step.name);
  var chain = Promise.resolve();

  step.dataStore.forEach(function(data) {
    chain = chain.then(function() {
      return Collection.findById(data._id).exec().then(function (doc) {
        if (doc && step.type === UPDATE) {
          return doc.update(data).exec();
        }
        else if (!doc && step.type === REMOVE) {
          doc = new Collection(data);
          return doc.save();
        }

        return Promise.resolve();
      });
    });
  });

  return chain.then(function(){
    return updateState(task, step.index, ROLLED);
  });
}

/**
 * Rollback for file save step.
 *
 * @param step the file save step
 * @param task the task containing the step.
 *
 * @returns {Promise|*}
 */
function rollbackFileSave(step, task) {
  var gfs = new Grid(mongoose.connection.db);

  return utils.removeFile(step.dataStore[0]._id, gfs)
    .then(function () {
      return updateState(task, step.index, ROLLED);
    });
}

/**
 * Rollback for file remove step.
 *
 * @param step the file remove step
 * @param task the task containing the step.
 *
 * @returns {Promise|*}
 */
function rollbackFileRemove(step, task) {
  return new Promise(function (resolve, reject) {
    var gfs = Grid(mongoose.connection.db);
    var data = step.dataStore[0];

    gfs.exist({_id: data.removed}, function (err, exists) {
      if (err) return reject(err);

      gfs.findOne({_id: data.shadow}, function (err, shadowFile) {
        if (err) return reject(err);
        if (!shadowFile) return resolve();

        function done() {
          utils.removeFile(data.shadow, gfs).then(function () {
            updateState(task, step.index, ROLLED)
              .then(resolve)
              .catch(reject);
          });
        }

        if (exists) return done();

        var writeStream = gfs.createWriteStream(shadowFile.metadata.oldFile);

        writeStream.on("close", done);
        writeStream.on("error", reject);

        gfs.createReadStream({_id: data.shadow}).pipe(writeStream);
      });
    });
  });
}

module.exports = RollerProvider;
