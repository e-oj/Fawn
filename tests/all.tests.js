"use strict";

/**
 * @author EmmanuelOlaojo
 * @since 6/22/16
 */

var fs = require("fs");

var config = require("../test_conf");
config.init();

var Fawn = config.Fawn;
var DB = config.DB;
var TASKS = config.TASKS;

global.mongoose = require("mongoose");
global.Grid = require("gridfs-stream");
Grid.mongo = mongoose.mongo;

global.dbUtils = require("../lib/utils/db.utils")(mongoose);
global.utils = require("../lib/utils/gen.utils");
global.expect = config.expect;
global.Promise = config.Promise;
global.TEST_COLLECTION_A = config.TEST_COLLECTION_A;
global.TEST_COLLECTION_B = config.TEST_COLLECTION_B;
global.TEST_COLLECTION_C = config.TEST_COLLECTION_C;
global.TEST_FILE_PATH = config.TEST_FILE_PATH;
global.TEST_FILE_TEXT = config.TEST_FILE_TEXT;
global.TEST_FILE_NAME = "FAWN_TEST.oj";
global.TEST_FILE_ID = global.dbUtils.generateId();

describe("ALL TESTS", function(){
  before(function(){
    Fawn.init(config.db + DB, TASKS);

    global.Task = Fawn.Task;
    global.task = Fawn.Task();
    global.taskMdl = task.getTaskCollection();

    global.TestMdlA = dbUtils.getModel(TEST_COLLECTION_A);
    global.TestMdlB = dbUtils.getModel(TEST_COLLECTION_B);
    global.TestMdlC = dbUtils.getModel(TEST_COLLECTION_C, {
      name: {type: String, required: true}
      , age: Number
    });

    fs.writeFileSync(TEST_FILE_PATH, TEST_FILE_TEXT);
  });

  after(function(){
    fs.unlinkSync(TEST_FILE_PATH);
    return dbUtils.dropCollection(TASKS);
  });

  require("./task.tests");
  require("./roller.tests");
});


