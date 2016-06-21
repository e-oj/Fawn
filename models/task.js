/**
 * This module dictates the structure of a
 * task.
 */
var mongoose =  require('mongoose');
var Schema = mongoose.Schema;

/**
 * The taskSchema is basically an object that contains
 * a user and one other user that they follow
 */
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
