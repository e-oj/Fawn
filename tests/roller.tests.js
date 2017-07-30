/**
 * @author EmmanuelOlaojo
 * @since 8/13/16
 */

module.exports = describe("Roller", function(){
  after(require("./cleanup"));

  describe("#roll", function(){
    it("should throw original error on failure", function(){
      task.save(TestMdlA, {name: "BoJack Horseman", age: 34})
        .save(TestMdlB, {name: "Puss in Boots", age: 26})
        .update(TestMdlA, {name: "BoJack Horseman"}, {name: "Samurai Jack", age: 300})
        .update(TEST_COLLECTION_B, {name: "Puss in Boots"}, {name: "Aristocat", age: 6})
        .update(TEST_COLLECTION_A, {_id: "blah"}, {name: "fail"});

      return expect(task.run())
        .to.eventually.be
        .rejectedWith(/must be a single String of 12 bytes or a string of 24 hex characters/);
    });

    it("should rollback save", function(){
      return task.save(TestMdlA, {name: "Arya Stark", age: 34})
        .update(TestMdlA, {_id: "blah"}, {name: "fail"})
        .run()
        .then(failure)
        .catch(function(){
          return expect(TestMdlA.find({name: "Arya Stark"}).exec())
            .to.eventually.have.length(0);
        });
    });

    it("should rollback update", function(){
      return task.save(TestMdlA, {name: "Tyrion Lannister", age: 34})
        .run()
        .then(function(result){
          return task.update(TestMdlA, {name: "Tyrion Lannister"}, {name: "Jamie", $inc: {age: 1}})
            .update(TestMdlA, {_id: "blah"}, {name: "fail"})
            .run()
            .then(failure)
            .catch(function(){
              return expect(TestMdlA.find({name: "Tyrion Lannister"}).exec())
                .to.eventually.have.length(1);
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

    it("should rollback file save", function () {
      var gfs = Grid(mongoose.connection.db);
      var id = utils.generateId();

      return task.saveFile(TEST_FILE_PATH, {_id: id})
        .remove(TestMdlA, {_id: "fail"})
        .run()
        .then(failure)
        .catch(function () {
          return expect(dbUtils.fileExists(id, gfs)).to.eventually.equal(false);
        });
    });

    it("should rollback file remove", function (done) {
      var gfs = Grid(mongoose.connection.db);
      var id = utils.generateId();
      var writeStream = gfs.createWriteStream({_id: id});

      writeStream.on("close", function () {
        task.removeFile({_id: id})
          .remove(TestMdlA, {_id: "fail"})
          .run()
          .then(failure)
          .catch(function () {
            dbUtils.fileExists(id, gfs).then(function (exists) {
              if (exists) dbUtils.removeFile(id, gfs);

              expect(exists).to.equal(true);
              done();
            });
          });
      });

      require("fs").createReadStream(TEST_FILE_PATH).pipe(writeStream);
    });
  });
});

function failure(){
  throw new Error("failed");
}