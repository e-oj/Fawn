/**
 * @author EmmanuelOlaojo
 * @since 8/13/16
 */

module.exports = describe("Roller", function(){
  after(require("./cleanup"));

  describe("#roll", function(){
    it("should throw original error on failure", function(){
      var _task = task.save(TestMdlA, {name: "BoJack Horseman", age: 34})
        .save(TestMdlB, {name: "Puss in Boots", age: 26})
        .update(TestMdlA, {name: "BoJack Horseman"}, {name: "Samurai Jack", age: 300})
        .update(TEST_COLLECTION_B, {name: "Puss in Boots"}, {name: "Aristocat", age: 6})
        .update(TEST_COLLECTION_A, {_id: "blah"}, {name: "fail"});

      return expect(_task.run()).to.eventually.be.rejectedWith(/Cast to ObjectId failed/);
    });

    it("should rollback save", function(){
      return task.save(TestMdlA, {name: "Arya Stark", age: 34})
        .update(TestMdlA, {_id: "blah"}, {name: "fail"})
        .run()
        .then(failure)
        .catch(function(){
          return expect(TestMdlA.find().exec()).to.eventually.have.length(0);
        });
    });

    it("should rollback update", function(){
      return task.save(TestMdlA, {name: "Tyrion Lannister", age: 34})
        .run()
        .then(function(){
          return task.update(TestMdlA, {name: "Tyrion Lannister"}, {name: "Jamie"})
            .remove(TestMdlB, {_id: "fail"})
            .run()
            .then(failure)
            .catch(function(){
              return expect(TestMdlA.find({name: "Tyrion Lannister"}).exec()).to.eventually.have.length(1);
            });
        })
    });

    it("should rollback remove", function(){
      return task.remove(TestMdlA, {name: "Tyrion Lannister"})
        .remove(TestMdlA, {_id: "fail"})
        .run()
        .then(failure)
        .catch(function(){
          return expect(TestMdlA.find({name: "Tyrion Lannister"}).exec()).to.eventually.have.length(1);
        });
    });
  });
});

function failure(){
  throw new Error("failed");
}