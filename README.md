# Lint
## Library for atomic-ish operations in MongoDB

Lint allows you to carry out edits on your database as a series of steps. If an error occurs on one of the steps, the database is returned to it's initial state (it's state before the transaction started). 

## Getting Started:

Install [node.js](https://nodejs.org) and [mongoDB](https://www.mongodb.com/download-center)

Start mongoDB in a terminal: ```mongod```

Then:
```npm install oj-lint```

## Usage:
```javascript
var Lint = require("oj-lint");
```
<br><b>Lint.init(db, _collection, options): Initialize Lint</b>
> db (required): [mongoose](https://github.com/Automattic/mongoose) instance or [connection string](https://docs.mongodb.com/manual/reference/connection-string/)

> _collection (optional): name of collection to be used internally by Lint

> options (optional. lol): Connection options. Same as [mongoose connection options](http://mongoosejs.com/docs/connections.html#options)

<br>If you're using mongoose in your project initialize Lint with mongoose:

```javascript
var mongoose = require("mongoose");

mongoose.connect("mongodb://127.0.0.1:27017/testDB");

//remember, _collection is optional
Lint.init(mongoose, "lint_collection_name_if_you_want_to_specify");
```

Without mongoose, Initialze Lint like so:

```javascript
//options object (http://mongoosejs.com/docs/connections.html#options)
var options = {
  user: "teh_huose_kat"
  pass: "teh_Kitti_passwrod"
}

var collection = "lint_collection_name_if_you_want_to_specify";

//remember, _collection and options are optional
Lint.init("mongodb://127.0.0.1:27017/testDB", collection || null, options || null);
```

<br><b>Lint.Task(): Create a Lint task</b>

After intitializing Lint, create a task like so:

```javascript
var task = Lint.Task();
```

  + <b>task.save(model, doc): To save a document</b>
  > model (required): Name of the collection we're saving to or a mongoose model or a mongoose document

  > doc (optional): object to save or a mongoose document
	
  <br>these are all valid:
  
  ```javascript
  var Cars = mongoose.model("cars", new Schema({make: String, year: Number}));
  var car = new Cars({make: "Toyota", year: 2016});
  
  task.save("cars", {make: "Toyota", year: 2016})
  task.save(Cars, {make: "Toyota", year: 2016})
  task.save("cars", car)
  task.save(Cars, car)
  task.save(car)
  ```
