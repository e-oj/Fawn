/**
 * This module dictates the structure of a
 * task.
 */
var mongoose =  require('mongoose');
var Schema = mongoose.Schema;

var taskSchema = new Schema({
  steps: [{
    type: {type: String, required: true}
    , index: {type: Number, required: true}
    , state: {type: String, required: true}
    , name: {type: String, required: true}
    , condition: String
    , data: {}
  }]
});

module.exports = function(collection){
  return mongoose.model(collection, taskSchema);
};
