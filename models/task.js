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
    , state: {type: Number, required: true}
    , name: {type: String, required: true}
    , condition: {}
    , oldData: [{}]
    , data: {}
  }]
});

module.exports = function(collection){
  return mongoose.model(collection, taskSchema);
};
