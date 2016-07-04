"use strict";

var config = {
  db: "mongodb://127.0.0.1:27017/"
  , DB: "test"
  , TASKS: "LINT"
  , Lint: require("./lib/lint")
  , Promise: require("bluebird")
  , TEST_COLLECTION_A: "humans"
  , TEST_COLLECTION_B: "animals"
  , chai: require("chai")
};

config.init =  function(){
  config.chai.use(require("chai-as-promised"));
};

config.expect = config.chai.expect;

module.exports = config;