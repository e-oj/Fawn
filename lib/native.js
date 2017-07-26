/**
 * @author EmmanuelOlaojo
 * @since 7/24/17
 */

var Promise = require("bluebird");
var mongoose = require("mongoose");

var constants = require("./constants");
var utils = require("./utils/gen.utils");

// utility functions
var resolveFuture = utils.resolveFuture;
var storeOldData = utils.storeOldData;
var updateState = utils.updateState;
var xcode = utils.xcode;

// constants
var PENDING = constants.PENDING;
var DONE = constants.DONE;

exports.nativeUpdate = function(db, step, task, results){
  var Collection = db.collection(step.name);
  var condition = xcode(step.condition);
  var data = utils.formatData(xcode(step.data));
  var update;

  resolveFuture(condition, results);
  resolveFuture(data, results);

  if(condition._id) condition._id = utils.generateId(condition._id);

  if(step.options && step.options.multi){
    update = Collection.updateMany(condition, data, step.options);
  }
  else update = Collection.updateOne(condition, data, step.options);

  return storeOldData(db, step, condition).then(function () {
    return updateState(task, step.index, PENDING).then(function () {
      return update.then(function (result) {
        results.push(result);

        return updateState(task, step.index, DONE, results);
      });
    });
  });
};
