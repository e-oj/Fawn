"use strict";

var config = {
  db: "mongodb://127.0.0.1:27017/"
  , DB: "OJFAWNTESTS"
  , TASKS: "lints"
  , Fawn: require("./lib/fawn")
  , Promise: require("bluebird")
  , TEST_COLLECTION_A: "humans"
  , TEST_COLLECTION_B: "pets"
  , TEST_COLLECTION_C: "animal"
  , TEST_FILE_TEXT: "This text is used to test file features"
  , TEST_FILE_PATH: "./test.oj"
  , chai: require("chai")
};

config.init = function () {
  config.chai.use(require("chai-as-promised"));
  config.expect = config.chai.expect;
};

module.exports = config;