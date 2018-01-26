"use strict";

module.exports = describe("Task", function(){
  after(require("./cleanup"));

  describe("#initModel", function(){
    it("should validate data when using mongoose", function(){
      var task = Task();
      var model = "cars";

      task.initModel(model, {
        make: {type: String, required: true}
        , year: {type: Number, required: true}
      });

      task.save(model, {name: "John"});

      return expect(task.run({useMongoose: true})).to.eventually.not.be.rejected;//With(/validation failed/);
    });
  });

  describe("#save", function(){
    it("should save successfully", function(){
      var emmanuel = new TestMdlA({name: "Emmanuel Olaojo", age: 20});
      var brian = new TestMdlB({name: "Brian Griffin", age: 18});

      task.save(TEST_COLLECTION_B, {name: "T-REX", age: 50000000});
      task.save(TestMdlA, emmanuel);
      task.save(TEST_COLLECTION_A, {name: "John Damos", age: 26});
      task.save(brian);

      return task.run();
    });

    it("should have Emmanuel Olaojo in " + TEST_COLLECTION_A, function(){
      return expect(TestMdlA.find({name: "Emmanuel Olaojo", age: 20}).exec()).to.eventually.have.length(1);
    });

    it("should have John Damos in " + TEST_COLLECTION_A, function(){
      return expect(TestMdlA.find({name: "John Damos", age: 26}).exec()).to.eventually.have.length(1);
    });

    it("should have T-REX in " + TEST_COLLECTION_B, function(){
      return expect(TestMdlB.find({name: "T-REX", age: 50000000}).exec()).to.eventually.have.length(1);
    });

    it("should have Brian Griffin in " + TEST_COLLECTION_B, function(){
      return expect(TestMdlB.find({name: "Brian Griffin", age: 18}).exec()).to.eventually.have.length(1);
    });

    it(TEST_COLLECTION_A + " should have length 2", function(){
      return expect(TestMdlA.find().exec()).to.eventually.have.length(2);
    });

    it(TEST_COLLECTION_B + " should have length 2", function(){
      return expect(TestMdlB.find().exec()).to.eventually.have.length(2);
    });
  });

  describe("#save nested object", function(){
    it("should save successfully with model", function(){
      var nested = new TestMdlA({name: "Nested User 1", info: {foo: 'bar', some: 'string'}});

      return task.save(TestMdlA, nested).run();
    });

    it("should have Nested User in " + TEST_COLLECTION_A, function(){
      return expect(TestMdlA.find({name: "Nested User 1", 'info.foo': 'bar'}).exec()).to.eventually.have.length(1);
    });

    it("should save successfully with only doc", function(){
      var nested = new TestMdlA({name: "Nested User 2", info: {foo: 'bar', some: 'string'}});

      return task.save(nested).run();
    });

    it("should have Nested User in " + TEST_COLLECTION_A, function(){
      return expect(TestMdlA.find({name: "Nested User 2", 'info.foo': 'bar'}).exec()).to.eventually.have.length(1);
    });

    it(TEST_COLLECTION_A + " should have length 4", function(){
      return expect(TestMdlA.find().exec()).to.eventually.have.length(4);
    });
  });

  describe("#update", function(){
    it("should update successfully", function(){
      return TestMdlB.findOne({name: "Brian Griffin"})
        .exec()
        .then(function(brian){
          task.update(TEST_COLLECTION_A, {name: {$in: ["John Damos"]}}, {name: "John Snow"});
          task.update(brian, {name: "Yo momma", $inc: {age: 20}});

          return task.run()
        });
    });

    it("should have Emmanuel Olaojo in " + TEST_COLLECTION_A, function(){
      return expect(TestMdlA.find({name: "Emmanuel Olaojo"}).exec()).to.eventually.have.length(1);
    });

    it("should have John Snow in " + TEST_COLLECTION_A, function(){
      return expect(TestMdlA.find({name: "John Snow"}).exec()).to.eventually.have.length(1);
    });

    it("should have Yo momma in " + TEST_COLLECTION_B + " with age 38", function(){
      return expect(TestMdlB.find({name: "Yo momma", age: 38}).exec()).to.eventually.have.length(1);
    });

    it("should have T-REX in " + TEST_COLLECTION_B, function(){
      return expect(TestMdlB.find({name: "T-REX"}).exec()).to.eventually.have.length(1);
    });

    it(TEST_COLLECTION_A + " should have length 4", function(){
      return expect(TestMdlA.find().exec()).to.eventually.have.length(4);
    });

    it(TEST_COLLECTION_B + " should have length 2", function(){
      return expect(TestMdlB.find().exec()).to.eventually.have.length(2);
    });
  });

  describe("#update - via save", function(){
    it("should update successfully with the viaSave option", function(done){
      var newAge = 4;

      var c = {name: "cat", age: 3};
      var cat = new TestMdlC(c);

      c._id = cat._id;
      c.age = newAge;

      task.save(cat)
        .update(cat, c)
        .options({viaSave: true})
        .run({useMongoose: true})
        .then(function(results){
          expect(results[1].age).to.equal(newAge);
          done();
        })
        .catch(done);
    });
  });

  describe("Special chars ('$' and '.')", function(){
    it("should update successfully with $gte", function(){
      return task.update(TestMdlB, {name: "Yo momma", age: {$gte: 38}}, {$inc: {age: 20}}).run();
    });

    it("should have Yo momma in " + TEST_COLLECTION_B + " with age 58", function(){
      return expect(TestMdlB.find({name: "Yo momma", age: 58}).exec()).to.eventually.have.length(1);
    });

    it("should update successfully with $inc", function(){
      return task.update(TestMdlB, {name: "Yo momma", age: {$in: [58, 59]}}, {$inc: {age: -20}}).run();
    });

    it("should have Yo momma in " + TEST_COLLECTION_B + " with age 38", function(){
      return expect(TestMdlB.find({name: "Yo momma", age: 38}).exec()).to.eventually.have.length(1);
    });

    it("should update nested objects successfully", function(){
      var getHeroes = function(count){
        var heroes = [];

        while(count--){
          heroes.push({hero: "The Squirrel fighter in Milan"});
        }

        return heroes;
      };

      return task.save(TestMdlA, {name: "Frank", age: 12, heroes: getHeroes(5)})
        .update(TestMdlA,
          {'heroes.hero': "The Squirrel fighter in Milan"},
          {$set: {"heroes.$.hero": "Captain Underpants"}})
        .run();
    });

    it("Should have Captain Underpants in Heroes", function(){
      return TestMdlA.findOne({name: "Frank", age: 12}).lean()
        .exec()
        .then(function(result){
          expect(result.heroes[0].hero).to.equal("Captain Underpants");

          return TestMdlA.remove({name: "Frank", age: 12})
            .exec();
        });
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
      return expect(TestMdlA.find({name: "John Snow"}).exec()).to.eventually.have.length(0);
    });

    it("should have Emmanuel Olaojo in " + TEST_COLLECTION_A, function(){
      return expect(TestMdlA.find({name: "Emmanuel Olaojo"}).exec()).to.eventually.have.length(1);
    });

    it("should not have Yo momma in " + TEST_COLLECTION_B, function(){
      return expect(TestMdlB.find({name: "Yo momma"}).exec()).to.eventually.have.length(0);
    });

    it("should have T-REX in " + TEST_COLLECTION_B, function(){
      return expect(TestMdlB.find({name: "T-REX"}).exec()).to.eventually.have.length(1);
    });

    it(TEST_COLLECTION_A + " should have length 3", function(){
      return expect(TestMdlA.find().exec()).to.eventually.have.length(3);
    });

    it(TEST_COLLECTION_B + " should have length 1", function(){
      return expect(TestMdlB.find().exec()).to.eventually.have.length(1);
    });
  });

  describe("#saveFile", function () {
    it("should save file successfully", function () {
      return task.saveFile(TEST_FILE_PATH, {_id: TEST_FILE_ID, filename: TEST_FILE_NAME})
        .run();
    });

    it("Should have file with _id '" + TEST_FILE_ID + "' in database", function () {
      var gfs = Grid(mongoose.connection.db);

      return expect(dbUtils.fileExists(TEST_FILE_ID, gfs)).to.eventually.equal(true);
    });
  });

  describe("#removeFile", function () {
    it("should remove file successfully", function () {
      return task.removeFile({filename: TEST_FILE_NAME}).run();
    });

    it("Should not have file with _id '" + TEST_FILE_ID + "' in database", function () {
      var gfs = Grid(mongoose.connection.db);

      return expect(dbUtils.fileExists(TEST_FILE_ID, gfs)).to.eventually.equal(false);
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
      return expect(TestMdlA.find({name: "John Snow"}).exec()).to.eventually.have.length(1);
    });

    it("should have OJ in " + TEST_COLLECTION_A, function(){
      return expect(TestMdlA.find({name: "OJ"}).exec()).to.eventually.have.length(1);
    });

    it("should have Pegasus in " + TEST_COLLECTION_B, function(){
      return expect(TestMdlB.find({name: "Pegasus"}).exec()).to.eventually.have.length(1);
    });

    it("should have Brian Griffin in " + TEST_COLLECTION_B, function(){
      return expect(TestMdlB.find({name: "Brian Griffin"}).exec()).to.eventually.have.length(1);
    });

    it(TEST_COLLECTION_A + " should have length 4", function(){
      return expect(TestMdlA.find().exec()).to.eventually.have.length(4);
    });

    it(TEST_COLLECTION_B + " should have length 2", function(){
      return expect(TestMdlB.find().exec()).to.eventually.have.length(2);
    });
  });

  describe("Run with mongoose", function(){
    var coll = "ufc_fighters";

    it("should run without errors", function(){
      task.save(coll, {name: "Jon Jones", champ: false})
        .save(coll, {name: "Daniel Cormier", champ: true})
        .update(coll, {name: {$ojFuture: "0.name"}}, {champ: true})
        .update(coll, {name: {$ojFuture: "1.name"}}, {champ: false})
        .save(coll, {name: "Damian Maia", champ: false})
        .remove(coll, {_id: {$ojFuture: "4._id"}});

      return expect(task.run({useMongoose: true}))
        .to.eventually.not.be.rejected;
    });

    it("should save and update successfully", function(){
      var db = mongoose.connection.db;
      var fighters = db.collection(coll);

      return Promise.all([
        expect(fighters.find({name: "Jon Jones", champ: true})
          .toArray())
          .to.eventually.have.length(1),
        expect(fighters.find({name: "Daniel Cormier", champ: false})
          .toArray())
          .to.eventually.have.length(1)
      ]);
    });

    it("should remove successfully", function(){
      var db = mongoose.connection.db;
      var fighters = db.collection(coll);

      return expect(fighters.find({name: "Damian Maia"})
        .toArray())
        .to.eventually.have.length(0)
    });
  });

  describe("Results Array", function () {
    it("Should have the results of all operations", function () {
      var gabe = new TestMdlB({name: "Gabe", age: 34});
      var id = dbUtils.generateId();

      return expect(
        task.save(gabe)
          .save(TEST_COLLECTION_A, {name: "Gabe's Owner", age: 60})
          .update(gabe, {age: 64})
          .saveFile(TEST_FILE_PATH, {_id: id, filename: {$ojFuture: "0.ops.0.name"}})
          .removeFile({_id: id})
          .remove(TEST_COLLECTION_A, {name: "Gabe's Owner"})
          .run())
        .to.eventually.have.length(6);
    });
  });

  describe("Templating tests for future data", function () {
    it("task with templated data should run successfully", function () {
      var mickey = new TestMdlB({name: "Mickey Mouse", age: 53, list: [{num: 53}]});
      var mick = new TestMdlA({name: "Mick", age: 3});

      return task.save(mickey)
        .save(mick)
        .save(TEST_COLLECTION_A, {name: "Alfie", age: {$ojFuture: "1.ops.0.age"}})
        .save(TEST_COLLECTION_B, {name: "Minnie Mouse", age: {$ojFuture: "0.ops.0.list.0.num"}})
        .update(TEST_COLLECTION_B, {name: {$ojFuture: "0.ops.0.name"}}, {age: {$ojFuture: "1.ops.0.age"}})
        .update(TEST_COLLECTION_A, {name: {$ojFuture: "1.ops.0.name"}}, {age: {$ojFuture: "3.ops.0.age"}})
        .remove(TEST_COLLECTION_A, {name: {$ojFuture: "2.ops.0.name"}, age: 3})
        .run();
    });

    it("Should have Mickey Mouse in " + TEST_COLLECTION_B + " with age 3", function () {
      return expect(TestMdlB.find({name: "Mickey Mouse", age: 3}).exec()).to.eventually.have.length(1);
    });

    it("Should have Mick in " + TEST_COLLECTION_A + " with age 53", function () {
      return expect(TestMdlA.find({name: "Mick", age: 53}).exec()).to.eventually.have.length(1);
    });

    it("Should have Minnie Mouse in " + TEST_COLLECTION_B + " with age 53", function () {
      return expect(TestMdlB.find({name: "Minnie Mouse", age: 53}).exec()).to.eventually.have.length(1);
    });

    it("Should not have Alfie in " + TEST_COLLECTION_A, function () {
      return expect(TestMdlA.find({name: "Alfie"}).exec()).to.eventually.have.length(0);
    });
  });
});
