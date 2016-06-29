/**
 * @author EmmanuelOlaojo
 * @since 6/22/16
 */

var chai = require("chai");
var expect = chai.expect;
var Promise = require("bluebird");
chai.use(require("chai-as-promised"));

var config = require("../test_conf");
var Lint = require("../lib/lint");
var DB = "test";
var TASKS = "LINT";
var TEST_COLLECTION = "humans";
var Task;
var testMdl;
var taskMdl;
var task;


describe("Task", function(){
  before(function(){
    var lint = new Lint(config.db + DB, TASKS);
    Task = lint.Task;
    task = new Task();
    testMdl = task.getCollection(TEST_COLLECTION);
    taskMdl = task.getTaskCollection();
  });

  after(function(){
    return task.dropCollection(TEST_COLLECTION);
  });
  
  it("should not run twice", function(){
    var task = new Task();

    task.run();
    expect(task.run).to.throw(/cannot be reused/);
  });

  it("should save successfully", function(){
    var task = new Task();

    task.save(TEST_COLLECTION, {name: "Emmanuel Olaojo", age: 20});
    task.save(TEST_COLLECTION, {name: "John Damos", age: 26});
    task.save(TEST_COLLECTION, {name: "unimportant", age: 5000});

    return task.run()
      .then(function(){
        return Promise.all([
          expect(testMdl.find({name: "Emmanuel Olaojo", age: 20})).to.eventually.have.length(1)
          , expect(testMdl.find({name: "John Damos", age: 26})).to.eventually.have.length(1)
          , expect(testMdl.find({name: "unimportant", age: 5000})).to.eventually.have.length(1)
        ])
      })
  });

  it("should update successfully", function(){
    var task = new Task();

    task.update(TEST_COLLECTION, {name: "John Damos"}, {name: "John Snow"});
    task.update(TEST_COLLECTION, {name: "Emmanuel Olaojo"}, {name: "OJ"});

    return task.run()
      .then(function(){
        return Promise.all([
          expect(testMdl.find({name: "John Snow"})).to.eventually.have.length(1)
          , expect(testMdl.find({name: "OJ"})).to.eventually.have.length(1)
          , expect(testMdl.find({name: "unimportant"})).to.eventually.have.length(1)
          , expect(testMdl.find({name: "John Damos"})).to.eventually.have.length(0)
          , expect(testMdl.find({name: "Emmanuel Olaojo"})).to.eventually.have.length(0)
        ]);
      })
  });

  it("should remove successfully", function(){
    var task =  new Task();

    task.remove(TEST_COLLECTION, {age: 5000});
    task.remove(TEST_COLLECTION, {name: "John Snow"});

    return task.run()
      .then(function(){
        return Promise.all([
          expect(testMdl.find({name: "John Snow"})).to.eventually.have.length(0)
          , expect(testMdl.find({name: "unimportant"})).to.eventually.have.length(0)
          , expect(testMdl.find({name: "OJ"})).to.eventually.have.length(1)
          , expect(testMdl.find()).to.eventually.have.length(1)
        ]);
      })
  });
});
