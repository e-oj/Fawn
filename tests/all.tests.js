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

global.utils = require("../lib/utils")();
global.expect = config.expect;
global.Promise = config.Promise;
global.TEST_COLLECTION_A = config.TEST_COLLECTION_A;
global.TEST_COLLECTION_B = config.TEST_COLLECTION_B;
global.TestMdlA = utils.getModel(TEST_COLLECTION_A);
global.TestMdlB = utils.getModel(TEST_COLLECTION_B);

describe("ALL TESTS", function(){
  before(function(){
    Lint.init(config.db + DB, TASKS);
    global.Task = Lint.Task;
    global.task = Lint.Task();
    global.taskMdl = task.getTaskCollection();
  });

  after(function(){
    return utils.dropCollection(TASKS);
  });

  require("./task.tests");
  require("./roller.tests");
});


