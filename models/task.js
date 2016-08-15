/**
 * This module dictates the structure of a
 * task.
 */
module.exports = function(_mongoose, collection){
  var mongoose =  _mongoose;
  var Schema = mongoose.Schema;

  var taskSchema = new Schema({
    steps: [{
      type: {type: String, required: true}
      , index: {type: Number, required: true}
      , state: {type: Number, required: true}
      , name: {type: String, required: true}
      , condition: {}
      , dataStore: [{}]
      , data: {}
      , options: {}
    }]
  });

  return mongoose.model(collection, taskSchema);
};
