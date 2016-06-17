/**
 * This module dictates the structure of a
 * task.
 */
var mongoose =  require('mongoose'),
  Schema = mongoose.Schema;
mongoose.connect('mongodb://127.0.0.1:27017/SurveyDB');
var _ = require("lodash");

/**
 * The taskSchema is basically an object that contains
 * a user and one other user that they follow
 */
var taskSchema = new Schema({
  name: {type: String, required: true}
  , start: {type: String, required: true}
  , clean: {type: String, required: true}
  , destroy: {type: String, required: true}
});

var model = mongoose.model("task", taskSchema);

var Survey = mongoose.model("name", new Schema(), "responses");

Survey.find({}, function(err, results){
  console.log(results);
});

module.exports = function(collection){
  return mongoose.model(collection, taskSchema);
};