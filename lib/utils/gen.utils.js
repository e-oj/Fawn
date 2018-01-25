/**
 * @author EmmanuelOlaojo
 * @since 7/26/17
 */

var constants = require("../constants");
var Promise = require("bluebird");
var $ = constants.$PREFIX;
var DOT = constants.DOT_PREFIX;

/**
 * Updates the state of a task's step.
 *
 * @param task the task
 * @param index the index of the step to update
 * @param state the new state of the step
 * @param results array of results from previous steps
 *
 * @returns {Promise|*}
 */
exports.updateState = function(task, index, state, results){
  var TskMdl = task.constructor;
  var condition = {_id: task._id};
  var setKey = "steps." + index +".state";
  var set = {};
  var update;

  set[setKey] = state;
  update = {$set: set};

  task.steps[index].state = state;

  return TskMdl.collection.updateOne(condition, update).then(function(){
    return Promise.resolve(results);
  });
};

/**
 * For encoding keys in user provided conditions,
 * options, and data in order to escape special chars
 * for writes and decoding object keys
 * before operations.
 *
 * @param item a JSON string or an object
 * @returns object or JSON string
 */
var xcode = exports.xcode = function(obj, dcode) {
  var keys = Object.keys(obj);

  keys.forEach(function(key){
    if(isObject(obj[key])){
      xcode(obj[key], dcode);
    }

    if(dcode) decode(obj, key);
    else encode(obj, key);
  });

  return obj;
};

/**
 * encodes object keys starting with "$"
 * or containing "."
 *
 * @param obj object containing suspect key
 * @param key key to encode
 */
function encode(obj, key){
  var newKey = null;

  if(key[0] === "$"){
    newKey = $ + key;
  }

  if(key.includes(".")){
    newKey = (newKey || key).split(".").join(DOT);
  }

  if(newKey){
    obj[newKey] = obj[key];
    delete obj[key]
  }
}

/**
 * Decodes an object's encoded keys
 *
 * @param obj obj with possibly encoded key
 * @param key key to decode
 */
function decode(obj, key){
  var newKey = key.split($).join("").split(DOT).join(".");

  if(key !== newKey){
    obj[newKey] = obj[key];
    delete obj[key];
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
var resolveFuture = exports.resolveFuture = function(obj, results) {
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
      }

      if (!result[parts[i]])
        throw new Error("No such key exists in result " + result + " at index" + index);
      result = result[parts[i]];
    }

    obj[key] = result;
  });
};

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
var isObject = exports.isObject = function(obj) {
  return obj && obj.constructor && obj.constructor === Object;
};

/**
 * Loosely check that a mongoose model is valid
 *
 * @param model the model to check
 *
 * @returns {boolean}
 */
exports.validModel = function(model){
  if (typeof model === "string") return true;

  return typeof model === "function" && model.modelName;
};

/**
 * Loosely checks that a mongoose document is valid.
 *
 * @param doc the document to check
 *
 * @returns {boolean}
 */
exports.validDoc = function(doc){
  return doc && doc._doc && doc.constructor && doc.constructor.modelName;
};

/**
 * Gets the name of a model
 *
 * @param model the model
 *
 * @returns the model's name
 */
exports.getModelName = function getModelName(model) {
  return typeof model === "string" ? model : model.modelName;
};

/**
 * Formats mongoose update data to match the
 * native driver.
 *
 *  var nativeData = formatData({name: "Oladapo", age: 23, $inc : {appCount: 1}})
 *  console.log(nativeData) // {$set: {name: Oladapo, age: 23}, $inc : {appCount: 1}}
 *
 * @param data mongoose formatted update object
 * @returns update object for native driver
 */
exports.formatData = function(data){
  var formatted = {};

  Object.keys(data).forEach(function(key){
    if(key.startsWith("$")){
      formatted[key] = data[key]
    }
    else{
      if(!formatted.$set) formatted.$set = {};

      formatted.$set[key] = data[key];
    }
  });

  return formatted;
};


