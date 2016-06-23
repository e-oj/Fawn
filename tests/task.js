/**
 * @author EmmanuelOlaojo
 * @since 6/22/16
 */

var chai = require("chai");
var expect = chai.expect;
chai.use(require("chai-as-promised"));

var config = require("../test_conf");
var Lint = require("../lib/lint");
var DB = "test";
var TASKS = "LINT";
var TEST_COLLECTION = "people";
var lint;
var Task;
var testMdl;
var taskMdl;
var task;

describe("Task", function(){
  before(function(){
    lint = new Lint(config.db + DB, TASKS);
    Task = lint.Task;
    task = new Task();
  });

  after(function(done){
    task.dropCollection(TEST_COLLECTION).then(function(){
      done();
    })
  });
  
  it("should save successfully and delete tasks", function(done){
    task.save(TEST_COLLECTION, {name: "Emmanuel Olaojo", age: 20});
    task.save(TEST_COLLECTION, {name: "John Damos", age: 26});
    task.run()
      .then(function(){
        testMdl = task.getCollection(TEST_COLLECTION);
        taskMdl = task.getTaskCollection();

        expect(testMdl.find()).to.eventually.have.length(2);
        expect(taskMdl.find()).to.eventually.have.length(0);
        done();
      })
      .catch(done);
  });

  
});
