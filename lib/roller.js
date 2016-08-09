"use strict";

/**
 * @author EmmanuelOlaojo
 * @since 7/31/16
 */

var TaskMdl;
var Promise = require("bluebird");
var constants = require("./constants");
var utils = require("./utils");

var INITIAL = constants.INITIAL;
var PENDING= constants.PENDING;
var DONE = constants.DONE;
var updateState = utils.updateState;
var getModel = utils.getModel;

var RollerProvider = function(_TaskMdl){
  TaskMdl = _TaskMdl;

  return Roller;
};

var Roller = function(){
  var roller = this;

  roller.roll = function(){
    var chain = Promise.resolve();

    return TaskMdl.find({}).exec()
      .then(function(tasks){
        var step;

        tasks.forEach(function(task){
          for(var i = 0; i < task.steps.length; i++){
            step = task.steps[i];

            if(step.state === INITIAL) break;

            (function(step){
              chain = chain.then(function(){
                return getRollbackFunc(step)(step, task);
              });
            })(step);
          }

          chain = chain.then(function(){
            return task.remove();
          });
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
