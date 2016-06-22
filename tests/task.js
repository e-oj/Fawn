/**
 * @author EmmanuelOlaojo
 * @since 6/22/16
 */

var chai = require("chai");
var expect = chai.expect;
chai.use(require("chai-as-promised"));

var config = require("../test_conf");
var Lint = require("../lib/lint");
var lint = new Lint(config.db + "SurveyDB", "_TASKS");
var Task = lint.Task;

var task = new Task();
var Response = task.getCollection("responses");

describe("Task", function(){
  it("should return a list of responses", function () {
    expect(Response.find()).to.eventually.have.length(5);
  });

  it("should successfully complete all steps", function(){
    
  });
});
