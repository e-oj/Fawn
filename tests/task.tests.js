"use strict";

module.exports = describe("Task", function(){
  var self = this;
  describe("#initModel", function(){
    it("should validate data", function(){
      var task = new Task();
      var model = "cars";

      task.initModel(model, {
        make: {type: String, required: true}
        , year: {type: Number, required: true}
      });

      task.save(model, {name: "John"});

      return expect(task.run()).to.eventually.be.rejectedWith(/validation failed/);
    });
  });

  describe("#save", function(){
    it("should save successfully", function(){
      var emmanuel = new TestMdlA({name: "Emmanuel Olaojo", age: 20});
      var brian = new TestMdlB({name: "Brian Griffin", age: 18});

      task.save(TEST_COLLECTION_B, {name: "T-REX", age: 50000000});
      task.save(emmanuel);
      task.save(TEST_COLLECTION_A, {name: "John Damos", age: 26});
      task.save(brian);

      return task.run();
    });

    it("should have Emmanuel Olaojo in " + TEST_COLLECTION_A, function(){
      return expect(TestMdlA.find({name: "Emmanuel Olaojo", age: 20})).to.eventually.have.length(1);
    });

    it("should have John Damos in " + TEST_COLLECTION_A, function(){
      return expect(TestMdlA.find({name: "John Damos", age: 26})).to.eventually.have.length(1);
    });

    it("should have T-REX in " + TEST_COLLECTION_B, function(){
      return expect(TestMdlB.find({name: "T-REX", age: 50000000})).to.eventually.have.length(1);
    });

    it("should have Brian Griffin in " + TEST_COLLECTION_B, function(){
      return expect(TestMdlB.find({name: "Brian Griffin", age: 18})).to.eventually.have.length(1);
    });

    it(TEST_COLLECTION_A + " should have length 2", function(){
      return expect(TestMdlA.find()).to.eventually.have.length(2);
    });

    it(TEST_COLLECTION_B + " should have length 2", function(){
      return expect(TestMdlB.find()).to.eventually.have.length(2);
    });
  });

  describe("#update", function(){
    it("should update successfully", function(){
      return TestMdlB.findOne({name: "Brian Griffin"})
        .exec()
        .then(function(brian){
          task.update(TEST_COLLECTION_A, {name: "John Damos"}, {name: "John Snow"});
          task.update(brian, {name: "Yo momma"});

          return task.run();
        });
    });

    it("should have Emmanuel Olaojo in " + TEST_COLLECTION_A, function(){
      return expect(TestMdlA.find({name: "Emmanuel Olaojo"})).to.eventually.have.length(1);
    });

    it("should have John Snow in " + TEST_COLLECTION_A, function(){
      return expect(TestMdlA.find({name: "John Snow"})).to.eventually.have.length(1);
    });

    it("should have Yo momma in " + TEST_COLLECTION_B, function(){
      return expect(TestMdlB.find({name: "Yo momma"})).to.eventually.have.length(1);
    });

    it("should have T-REX in " + TEST_COLLECTION_B, function(){
      return expect(TestMdlB.find({name: "T-REX"})).to.eventually.have.length(1);
    });

    it(TEST_COLLECTION_A + " should have length 2", function(){
      return expect(TestMdlA.find()).to.eventually.have.length(2);
    });

    it(TEST_COLLECTION_B + " should have length 2", function(){
      return expect(TestMdlB.find()).to.eventually.have.length(2);
    });
  });

  describe("#remove", function(){
    it("should remove successfully", function(){
      return TestMdlB.findOne({name: "Yo momma"})
        .exec()
        .then(function(yoMomma){
          task.remove(TEST_COLLECTION_A, {name: "John Snow"});
          task.remove(yoMomma);

          return task.run();
        });
    });

    it("should not have John Snow in " + TEST_COLLECTION_A, function(){
      return expect(TestMdlA.find({name: "John Snow"})).to.eventually.have.length(0);
    });

    it("should have Emmanuel Olaojo in " + TEST_COLLECTION_A, function(){
      return expect(TestMdlA.find({name: "Emmanuel Olaojo"})).to.eventually.have.length(1);
    });

    it("should not have Yo momma in " + TEST_COLLECTION_B, function(){
      return expect(TestMdlB.find({name: "Yo momma"})).to.eventually.have.length(0);
    });

    it("should have T-REX in " + TEST_COLLECTION_B, function(){
      return expect(TestMdlB.find({name: "T-REX"})).to.eventually.have.length(1);
    });

    it(TEST_COLLECTION_A + " should have length 1", function(){
      return expect(TestMdlA.find()).to.eventually.have.length(1);
    });

    it(TEST_COLLECTION_B + " should have length 1", function(){
      return expect(TestMdlB.find()).to.eventually.have.length(1);
    });
  });

  describe("allTogetherNow", function(){
    it("should save, update and remove successfully", function(){
      var brian = new TestMdlB({name: "Brian Griffin", age: 18});

      return task.save(TEST_COLLECTION_A, {name: "John Snow", age: 26})
        .update(TestMdlB, {name: "T-REX"}, {name: "Pegasus"})
        .update(TEST_COLLECTION_A, {name: "Emmanuel Olaojo"}, {name: "OJ"})
        .save(TestMdlA, {name: "unimportant", age: 50})
        .remove(TEST_COLLECTION_A, {name: "unimportant"})
        .save(brian)
        .save(TEST_COLLECTION_B, {name: "Yo momma", age: 18})
        .remove(TestMdlB, {name: "Yo momma"})
        .run();
    });

    it("should have John Snow in " + TEST_COLLECTION_A, function(){
      return expect(TestMdlA.find({name: "John Snow"})).to.eventually.have.length(1);
    });

    it("should have OJ in " + TEST_COLLECTION_A, function(){
      return expect(TestMdlA.find({name: "OJ"})).to.eventually.have.length(1);
    });

    it("should have Pegasus in " + TEST_COLLECTION_B, function(){
      return expect(TestMdlB.find({name: "Pegasus"})).to.eventually.have.length(1);
    });

    it("should have Brian Griffin in " + TEST_COLLECTION_B, function(){
      return expect(TestMdlB.find({name: "Brian Griffin"})).to.eventually.have.length(1);
    });

    it(TEST_COLLECTION_A + " should have length 2", function(){
      return expect(TestMdlA.find()).to.eventually.have.length(2);
    });

    it(TEST_COLLECTION_B + " should have length 2", function(){
      return expect(TestMdlB.find()).to.eventually.have.length(2);
    });
  });
});