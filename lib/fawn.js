"use strict";

/**
 * @author EmmanuelOlaojo
 * @since 6/15/16
 */
var Promise = require("bluebird");
var constants = require("./constants");
var mongoose;
var collection;
var TaskMdl;
var Task;
var Roller;
var dbUtils;

var Fawn = {
  init: function(db, _collection, options) {
    var dbType = typeof db;
    var types = "objectstring";

    if (!(db && types.includes(dbType))) throw new Error("Please specify a mongoose instance or a connection string");

    options = options ? cleanOptions(options) : {};

    if (dbType === "object") {
      if (isMongoose(db)) {
        mongoose = db;
      }
      else{
        throw new Error("The provided mongoose instance is invalid");
      }
    }
    else{
      mongoose = require("mongoose");
      options.useMongoClient = true;
      mongoose.connect(db, options);
    }

    mongoose.Promise = Promise;
    collection = _collection || constants.DEFAULT_COLLECTION;
    TaskMdl = require("../models/task")(mongoose, collection);
    Task = require("./task")(mongoose, TaskMdl);
    Roller = require("./roller")(mongoose, TaskMdl);
    dbUtils = require("./utils/db.utils")(mongoose);
  }

  , Task: function() {
    checkInitStatus();
    return new Task();
  }

  , Roller: function() {
    checkInitStatus();
    return Roller;
  }

  , initModel: function (modelName, schema) {
    checkInitStatus();
    dbUtils.initModel(modelName, schema);
  }
};

function checkInitStatus() {
  if (!(Roller)) {
    throw new Error("Fawn has not been initialized. Call Fawn.init");
  }
}

function cleanOptions(options) {
  if (typeof options !== "object") return {};

  var clean = {};
  var properties = ["db", "server", "replset", "user", "pass", "auth", "mongos", "promiseLibrary"];

  properties.forEach(function (prop) {
    if (options[prop]) clean[prop] = options[prop];
  });

  return clean;
}

function isMongoose(obj) {
  return obj.connections instanceof Array
    && obj.connections.length >= 1
    && obj.connections[0].base
    && obj.connections[0].collections
    && obj.connections[0].models
    && obj.connections[0].config
    && obj.connections[0].otherDbs instanceof Array
    && obj.plugins instanceof Array
    && obj.models
    && obj.modelSchemas
    && obj.options;
}

module.exports = Fawn;
