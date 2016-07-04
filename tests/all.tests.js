"use strict";

/**
 * @author EmmanuelOlaojo
 * @since 6/22/16
 */

var config = require("../test_conf");
config.init();

var Lint = config.Lint;
var DB = config.DB;
var TASKS = config.TASKS;

global.expect = config.expect;
global.Promise = config.Promise;
global.TEST_COLLECTION_A = config.TEST_COLLECTION_A;
global.TEST_COLLECTION_B = config.TEST_COLLECTION_B;

describe("ALL TESTS", function(){
  before(function(){
    var lint = new Lint(config.db + DB, TASKS);
    global.Task = lint.Task;
    global.task = new Task();
    global.testMdlA = task.getCollection(TEST_COLLECTION_A);
    global.testMdlB = task.getCollection(TEST_COLLECTION_B);
    global.taskMdl = task.getTaskCollection();
  });

  after(function(){
    return Promise.all([
      task.dropCollection(TEST_COLLECTION_A)
      , task.dropCollection(TEST_COLLECTION_B)
    ]);
  });

  require("./task.tests");
});


