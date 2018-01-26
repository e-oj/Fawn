/**
 * @author EmmanuelOlaojo
 * @since 7/24/17
 */

var constants = require("../constants");
var utils = require("../utils/gen.utils");

var dbUtils;
var storeOldData;
exports.setDbUtils = function (_dbUtils) {
    dbUtils = _dbUtils;
    storeOldData = _dbUtils.storeOldData;
};

// utility functions
var resolveFuture = utils.resolveFuture;
var updateState = utils.updateState;
var xcode = utils.xcode;

// constants
var PENDING = constants.PENDING;
var DONE = constants.DONE;

/**
 * This function handles updates using the
 * native driver
 *
 * @param db
 * @param step the update step
 * @param task the task which step belongs to
 * @param results array of results from previous operations
 *
 * @returns {Promise|*}
 */
exports.nativeUpdate = function(db, step, task, results){
  var Collection = db.collection(step.name);
  var condition = xcode(step.condition, true);
  var data = utils.formatData(xcode(step.data, true));

  resolveFuture(condition, results);
  resolveFuture(data, results);

  return storeOldData(db, step, condition).then(function () {
    return updateState(task, step.index, PENDING).then(function () {
      var update;

      if(step.options && step.options.multi){
        update = Collection.updateMany(condition, data, step.options);
      }
      else update = Collection.updateOne(condition, data, step.options);

      return update.then(function (result) {
        results.push(result);

        return updateState(task, step.index, DONE, results);
      });
    });
  });
};

/**
 * This function handles saves using the
 * native driver
 *
 * @param db native db
 * @param step the save step
 * @param task the task which step belongs to
 * @param results array of results from previous operations
 *
 * @returns {Promise|*}
 */
exports.nativeSave = function(db, step, task, results){
  var collection = db.collection(step.name);
  var doc = xcode(step.data, true);

  resolveFuture(doc, results);

  doc._id = doc._id || dbUtils.generateId();
  step.dataStore = [{_id: doc._id}];

  return updateState(task, step.index, PENDING).then(function(){
    return collection.insertOne(doc).then(function(result){
      results.push(result);

      return updateState(task, step.index, DONE, results);
    });
  });
};

/**
 * This function handles removes using the
 * native driver.
 *
 * @param db native db
 * @param step the remove step
 * @param task the task which step belongs to
 * @param results array of results from previous operations
 *
 * @returns {Promise|*}
 */
exports.nativeRemove = function(db, step, task, results){
  var collection = db.collection(step.name);
  var condition = xcode(step.condition, true);

  resolveFuture(condition, results);

  return storeOldData(db, step, condition).then(function(){
    return updateState(task, step.index, PENDING).then(function(){
      return collection.deleteMany(condition).then(function(result){
        results.push(result);

        return updateState(task, step.index, DONE, results);
      });
    });
  });
};
