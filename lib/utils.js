"use strict";

/**
 * @author EmmanuelOlaojo
 * @since 8/9/16
 */
var modelCache = {};
var Promise = require("bluebird");

var constants = require("./constants");

module.exports = function(_mongoose){
  var mongoose = _mongoose || require("mongoose");
  var Schema = mongoose.Schema;

  function updateState(task, index, state, results) {
    task.steps[index].state = state;

    return task.save()
      .then(function () {
        return Promise.resolve(results);
      });
  }

  function getCollection(name, schema){
    if (schema) {
      return mongoose.model(name, schema);
    }

    return mongoose.model(name);
  }

  function setModel(name, schema){
    modelCache[name] = getCollection(name, schema);
  }

  function getModel(name, schema){
    if(!modelCache[name]){
      setModel(name, schema);
    }
    
    return modelCache[name];
  }

  /**
   * Initializes a mongoose model with name: modelName.
   * If a schema is provided, it will be used to construct the model
   * else, the model will be initialized with a default, unrestricted
   * schema.
   *
   * @param modelName The intended name of the model
   * @param schema The schema associated with this model
   */
  function initModel(modelName, schema) {
    if (modelCache[modelName]) throw new Error("The schema for this model has already been set");
    if (schema && typeof schema !== "object") throw new Error("Invalid Schema");

    var DEFAULT_SCHEMA = new Schema({}, {strict: false});

    setModel(modelName, schema ? new Schema(schema, {strict: true}) : DEFAULT_SCHEMA);
  }

  function dropCollection(collection){
    return new Promise(function(resolve, reject){
      mongoose.connection.db.dropCollection(collection, function(err) {
        if(err) reject(err);
        else resolve();
      });
    });
  }

  function removeFile(id, gfs) {
    var options = {_id: id};

    if (id.constructor && id.constructor === Object) {
      options = id;
    }

    return new Promise(function (resolve, reject) {
      gfs.remove(options, function (err, result) {
        if (err) return reject(err);

        resolve(result);
      });
    });
  }

  function fileExists(id, gfs) {
    return new Promise(function (resolve, reject) {
      gfs.exist({_id: id}, function (err, exists) {
        if (err) return reject(err);

        resolve(exists);
      });
    });
  }

  function makeRemoveChain(task, gfs) {
    var removeChain = Promise.resolve();

    task.steps.forEach(function (step) {
      if (step.type !== constants.FILE_REMOVE) return;

      var shadowId = step.dataStore[0].shadow;

      removeChain = removeChain.then(function () {
        return fileExists(shadowId, gfs)
          .then(function (exists) {
            if (!exists) return Promise.resolve();

            return removeFile(shadowId, gfs);
          });
      });
    });

    return removeChain;
  }

  function generateID(){
    return mongoose.Types.ObjectId();
  }

  return {
    updateState: updateState
    , setModel: setModel
    , getModel: getModel
    , initModel: initModel
    , modelCache: modelCache
    , dropCollection: dropCollection
    , generateId: generateID
    , removeFile: removeFile
    , fileExists: fileExists
    , makeRemoveChain: makeRemoveChain
  };
};
