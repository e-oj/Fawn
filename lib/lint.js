/**
 * @author EmmanuelOlaojo
 * @since 6/15/16
 */
var mongoose = require("mongoose");

var Lint = function(){
  var lint = this;
  var TaskMdl;

  lint.connect = function(db, collection, options){
    if(!db) throw new Error("No database specified");
    if(!collection) throw new Error("No collection specified");
    if(options && Object.keys(options).length) options = cleanOptions(options);

    collection = collection.toString();
    db = db.toString();

    mongoose.connect(db, options);
    TaskMdl = require("../models/task")(collection);
    lint.Task = require("./task")(mongoose, TaskMdl);
  };
};

function cleanOptions(options){
  if(!(options.user && options.pass)) throw new Error("options object must contain keys: 'user' && 'pass'");

  return{
    user: options.user
    , pass: options.pass
  }
}

module.exports = Lint;