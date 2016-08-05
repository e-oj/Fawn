"use strict";

/**
 * @author EmmanuelOlaojo
 * @since 7/31/16
 */

var TaskMdl;
var Promise = require("bluebird");

var RollerProvider = function(_TaskMdl){
  TaskMdl = _TaskMdl;

  return Roller;
};

var Roller = function(){
  var roller = this;

  roller.roll = function(){
    var chain = Promise.resolve();

    return TaskMdl.find({}).exec()
      .then(function(docs){
        docs.forEach(function(doc){
          doc.steps.forEach(function(step){
            chain = chain.then(function(){
              return getRollbackFunc(step)(step, _task)
            });
          })
        });

        return chain;
      });
  };

  function getRollbackFunc(step){
    switch(step.type){
      case "save": return rollbackSave;
    }
  }

  function rollbackSave(step, task) {

  }
};
