/**
 * @author EmmanuelOlaojo
 * @since 7/29/17
 */
var constants = require("../constants");
var utils = require("../utils/gen.utils");
var dbUtils;

// gen utility functions
var resolveFuture = utils.resolveFuture;
var updateState = utils.updateState;
var xcode = utils.xcode;

// db utility functions
var getModel;
var storeOldData;

// constants
var PENDING = constants.PENDING;
var DONE = constants.DONE;

exports.setDbUtils = function (_dbUtils) {
  dbUtils = _dbUtils;
  getModel = dbUtils.getModel;
  storeOldData = dbUtils.storeOldData;
};

/**
 * This function handles the update step using
 * mongoose.
 *
 * @param db native db
 * @param step the update step
 * @param task the task which step belongs to
 * @param results array of results from previous operations
 *
 * @returns {Promise|*}
 */
exports.performUpdate = function(db, step, task, results) {
  var Collection = getModel(step.name);
  var condition = xcode(step.condition, true);
  var data = xcode(step.data, true);

  resolveFuture(condition, results);
  resolveFuture(data, results);

  return storeOldData(db, step, condition).then(function () {
    return updateState(task, step.index, PENDING).then(function () {
      var update;

      if(step.useMongoose && step.options && step.options.viaSave){
        var doc = new Collection(data);
        doc.isNew = false;
        update = doc.save();
      }
      else update = Collection.update(condition, data, step.options).exec();

      return update.then(function (result) {
        results.push(result);

        return updateState(task, step.index, DONE, results);
      });
    });
  });
};

/**
 * This function handles the save step using
 * mongoose.
 *
 * @param step the save step
 * @param task the task which step belongs to
 * @param results array of results from previous operations
 *
 * @returns {Promise|*}
 */
exports.performSave = function performSave(step, task, results) {
  var Collection = getModel(step.name);
  var data = xcode(step.data, true);

  resolveFuture(data, results);

  var doc = new Collection(data);
  var dataStore = [];

  doc._id = doc._id || dbUtils.generateId();
  dataStore.push({_id: doc._id});

  step.dataStore = dataStore;

  return updateState(task, step.index, PENDING).then(function () {
    return doc.save().then(function (result) {
      results.push(result);

      return updateState(task, step.index, DONE, results)
    });
  });
};

/**
 * This function handles the remove step using
 * mongoose.
 *
 * @param db native db
 * @param step the remove step
 * @param task the task which step belongs to
 * @param results array of results from previous operations
 *
 * @returns {Promise|*}
 */
exports.performRemove = function(db, step, task, results) {
  var Collection = getModel(step.name);
  var condition = xcode(step.condition, true);

  resolveFuture(condition, results);

  return storeOldData(db, step, condition).then(function () {
    return updateState(task, step.index, PENDING).then(function () {
      return Collection.remove(condition).exec().then(function (result) {
        results.push(result);

        return updateState(task, step.index, DONE, results);
      });
    });
  });
};

