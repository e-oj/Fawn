"use strict";

/**
 * @author EmmanuelOlaojo
 * @since 8/9/16
 */
var modelCache = {};
var Promise = require("bluebird");

var constants = require("../constants");
var utils = require("./gen.utils");
var mongoose;

module.exports = function(_mongoose) {
  mongoose = _mongoose;
  var Schema = mongoose.Schema;

  /**
   * gets a collection as a mongoose model.
   *
   * @param name name of the collection
   * @param schema schema for the model
   */
  function getCollection(name, schema){
    if (schema) return mongoose.model(name, schema);

    try {
      return mongoose.model(name);
    } catch (err){
      initModel(name, schema);
      return mongoose.model(name);
    }
  }

  /**
   * Adds a model to the model cache
   *
   * @param name name of model
   * @param schema schema for the model
   */
  function setModel(name, schema) {
    modelCache[name] = getCollection(name, schema);
  }

  /**
   * Gets a mongoose model. Creates one if it
   * doesn't exist already.
   *
   * @param name name of the model to retrieve
   * @param schema schema for the model
   *
   * @returns a mongoose model
   */
  function getModel(name, schema) {
    if (!modelCache[name]) {
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

  /**
   * Drops a MongoDB collection. For testing.
   *
   * @param collection the name of the collection to be dropped
   */
  function dropCollection(collection) {
    return new Promise(function(resolve, reject) {
      mongoose.connection.db.dropCollection(collection, function(err) {
        if(err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Removes a file from the db
   *
   * @param id file id or options object
   * @param gfs GridFS
   */
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

  /**
   * Checks if a file exists in the db with the
   * specified file name
   *
   * @param id MongoDB ObjectId
   * @param gfs GridFS
   */
  function fileExists(id, gfs) {
    return new Promise(function (resolve, reject) {
      gfs.exist({_id: id}, function (err, exists) {
        if (err) return reject(err);

        resolve(exists);
      });
    });
  }

  /**
   * Chains together the deletion of shadow files
   * from file remove steps.
   *
   * @param task the task to check for shadow files
   * @param gfs GridFS
   *
   * @returns {Promise|*}
   */
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

    /**
     * generates a MongoDB ObjectId
     */
    function generateId(id) {
        return new mongoose.Types.ObjectId(id);
    }

    /**
     * Gets the collection for a step
     *
     * @param db native db
     * @param step the step in question
     *
     * @returns native collection
     */
    function getCollectionForStep(db, step){
        return step.useMongoose
            ? mongoose.model(step.name).collection
            : db.collection(step.name)
    }

    /**
     * This function stores data that's about to be
     * changed by a step, for rollback purposes
     *
     * @param db native db
     * @param step the step
     * @param condition literal obj rep of the step's condition
     *
     * @returns {Promise|*}
     */
    function storeOldData(db, step, condition){
        var Collection = getCollectionForStep(db, step);
        var options = step.options
            ? utils.xcode(step.options)
            : step.type === constants.REMOVE ? {multi: true} : null;
        var query = Collection.find(condition);
        var searchQuery = options && options.multi === true
            ? query
            : query.limit(1);

        return searchQuery.toArray().then(function(result){
            step.dataStore = result;
        });
    }
  return {
    setModel: setModel
    , getModel: getModel
    , initModel: initModel
    , modelCache: modelCache
    , dropCollection: dropCollection
    , removeFile: removeFile
    , fileExists: fileExists
    , makeRemoveChain: makeRemoveChain
    , generateId: generateId
    , getCollection: getCollection
    , getCollectionForStep: getCollectionForStep
    , storeOldData: storeOldData
  };
};
