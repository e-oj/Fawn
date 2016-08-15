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

var Lint = {
  init: function(db, _collection, options){
    var dbType = typeof db;
    var types = "objectstring";

    if(!(db && types.includes(dbType))) throw new Error("Please specify a mongoose instance or a connection string");
    if(options) options = cleanOptions(options);

    if(dbType === "object"){
      if(isMongoose(db)) {
        mongoose = db
      }
      else{
        throw new Error("The provided mongoose instance is invalid");
      }
    }
    else{
      mongoose = require("mongoose");
      mongoose.connect(db, options)
    }

    mongoose.Promise = Promise;
    collection = _collection || constants.DEFAULT_COLLECTION;
    TaskMdl = require("../models/task")(mongoose, collection);
  }

  , Task: function(){
    checkInitStatus();

    if(!Task) {
      Task = require("./task")(mongoose, TaskMdl);
    }

    return new Task();
  }

  , Roller: function(){
    checkInitStatus();

    if(!Roller){
      Roller = require("./roller")(mongoose, TaskMdl);
    }

    return Roller;
  }
};

function checkInitStatus(){
  if(!(mongoose && collection && TaskMdl)){
    throw new Error("Lint has not been initialized. Call Lint.init");
  }
}

function cleanOptions(options){
  if(typeof options !== "object") return {};
  
  var clean = {};

  if(options.db) clean.db = options.db;
  if(options.server) clean.server = options.server;
  if(options.replset) clean.replset = options.replset;
  if(options.user) clean.user = options.user;
  if(options.pass) clean.pass = options.pass;
  if(options.auth) clean.auth = options.auth;
  if(options.mongos) clean.mongos = options.mongos;
  if(options.promiseLibrary) clean.promiseLibrary = options.promiseLibrary;

  return clean;
}

function isMongoose(obj){
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

module.exports = Lint;
