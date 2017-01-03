"use strict";

/**
 * @author EmmanuelOlaojo
 * @since 8/9/16
 */
var modelCache = {};

module.exports = function(_mongoose){
  var mongoose = _mongoose || require("mongoose");
  var Schema = mongoose.Schema;

  function updateState(task, index, state){
    task.steps[index].state = state;
    return task.save();
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

  function dropCollection(collection){
    return new Promise(function(resolve, reject){
      mongoose.connection.db.dropCollection(collection, function(err) {
        if(err) reject(err);
        else resolve();
      });
    });
  }

  function generateID(){
    return mongoose.Types.ObjectId();
  }

  return {
    updateState: updateState
    , setModel: setModel
    , getModel: getModel
    , modelCache: modelCache
    , dropCollection: dropCollection
    , generateId: generateID
  };
};
