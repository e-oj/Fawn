/**
 * @author EmmanuelOlaojo
 * @since 7/24/17
 */

var Promise = require("bluebird");
var constants = require("./constants");
var utils = require("./utils/gen.utils");

// utility functions
var resolveFuture = utils.resolveFuture;
var storeOldData = utils.storeOldData;
var updateState = utils.updateState;

exports.nativeUpdate = function(step, task, results){
  var Collection = task.constructor.collection;
  var condition = xcode(step.condition);
  var data = xcode(step.data);
  var updateFunc = Collection.updateOne;

  resolveFuture(condition, results);
  resolveFuture(data, results);

  if(step.options && step.options.multi){
    updateFunc = Collection.updateMany;
    delete step.options.multi;
  }

};
