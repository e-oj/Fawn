"use strict";

/**
 * @author EmmanuelOlaojo
 * @since 6/22/16
 */

var config = require("../test_conf");
var utils = require("../lib/utils");
config.init();

var Lint = config.Lint;
var DB = config.DB;
var TASKS = config.TASKS;

global.expect = config.expect;
global.Promise = config.Promise;
global.TEST_COLLECTION_A = config.TEST_COLLECTION_A;
global.TEST_COLLECTION_B = config.TEST_COLLECTION_B;
global.TestMdlA = utils.getModel(TEST_COLLECTION_A);
global.TestMdlB = utils.getModel(TEST_COLLECTION_B);

describe("ALL TESTS", function(){
  before(function(){
    var lint = new Lint(config.db + DB, TASKS);
    global.Task = lint.Task;
    global.task = new Task();
    global.taskMdl = task.getTaskCollection();
  });

  after(function(){
    return Promise.all([
      utils.dropCollection(TEST_COLLECTION_A)
      , utils.dropCollection(TEST_COLLECTION_B)
      , utils.dropCollection(TASKS)
    ]);
  });

  require("./task.tests");
});


