require('dotenv').config();
const express = require("express");
const app = express();
const ejs = require("ejs");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const date = require(__dirname + "/date.js");
const webpush = require('web-push');
const https = require('https');
const unirest = require('unirest');

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: "Out little secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb+srv://priyank:micro123@hackathon-ae71h.mongodb.net/hackUserDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true
});

const grocerySchema = {

  itemName: String,
  quantity: Number,
  dateofBuying: Date,
  numDaysToExpire: Number,
  expiryDate: Date
};

const Grocery = mongoose.model("Grocery", grocerySchema);

const UserSchema = new mongoose.Schema({
  name: {
    type: String
  },
  username: {
    type: String
  },
  password: {
    type: String,
  },
  grocery: [grocerySchema]
});

UserSchema.plugin(passportLocalMongoose);
const User = mongoose.model("HackathonUser", UserSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

app.route("/")
  .get(function(req, res) {
    res.render("home");
  });

// EatIT page

app.route("/eatit")
  .get(function(req, res) {
    if (req.isAuthenticated()) {
      User.findOne({
        username: req.user.username
      }, function(err, foundUser) {
        if (foundUser) {
          const availableItems = foundUser.grocery;

          res.render("eatIT", {
            name: req.user.name,
            availableItems: availableItems,
            helpers: date
          });
        } else {
          console.log("Not Found");
        }
      });

    } else {
      res.redirect("/login");
    }
  });
app.post("/eatit", function(req, res) {
  var availableItems = [];
  const username = req.user.username;
  const newGroceryItem = new Grocery({
    itemName: req.body.itemname,
    quantity: req.body.quantity,
    dateofBuying: new Date(),
    numDaysToExpire: req.body.expiry,
    expiryDate: date.addDays(new Date(), Number(req.body.expiry))
  });

  User.findOne({
    username: username
  }, function(err, foundUser) {
    if (foundUser) {
      console.log(foundUser.name);
      if (foundUser.grocery)
        availableItems = foundUser.grocery;
      availableItems.push(newGroceryItem);
    }
  });
  const update = {
    "$push": {
      grocery: newGroceryItem
    }
  };
  User.findOneAndUpdate({
    username: username
  }, update, {
    new: true
  }, function(err) {
    if (err) {
      console.log(err);
    } else {
      console.log("Update Successful");
    }
  });

  res.redirect("/eatit");
});


// Manage page
app.route("/manage")
  .get(function(req, res) {
    var availableItems = [];
    if (req.isAuthenticated()) {
      const username = req.user.username;
      User.findOne({
        username: req.user.username
      }, function(err, foundUser) {
        if (foundUser) {
          availableItems = foundUser.grocery;
          for (var i = 0; i < availableItems.length; i++) {
            availableItems[i].numDaysToExpire = date.remainingDays(availableItems[i].expiryDate);
          }
          console.log(availableItems);
          User.findOneAndUpdate({
            username: req.user.username
          }, {
            $set: {
              grocery: availableItems
            }
          }, function(err) {
            if (err) {
              console.log(err);
            } else {
              var sortedItems = availableItems;
              sortedItems.sort((a, b) => (a.numDaysToExpire > b.numDaysToExpire) ? 1 : -1)
              console.log("Expire Date updated");
              res.render("manage", {
                name: req.user.name,
                availableItems: sortedItems,
                helpers: date
              });
            }
          });
        } else {
          console.log("Not Found");
        }
      });
    } else {
      res.redirect("/login");
    }
  })
  .post(function(req, res) {
    const quantity = req.body.quantity;
    const dateofBuying = req.body.update;
    var availableItems = [];
    User.findOne({
      username: req.user.username
    }, function(err, foundUser) {
      if (foundUser) {
        availableItems = foundUser.grocery;
        for (var i = 0; i < availableItems.length; i++) {
          if (availableItems[i].dateofBuying == dateofBuying) {
            availableItems[i].quantity = quantity;
            break;
          }
        }
        User.findOneAndUpdate({
          username: req.user.username
        }, {
          $set: {
            grocery: availableItems
          }
        }, function(err) {
          if (err) {
            console.log(err);
          } else {
            console.log("Done Successfully");
          }
        });
      }
    });
    res.redirect("/manage");
  });

// ToBuy page

app.route("/toBuy")
  .get(function(req, res) {
    var availableItems = [];
    var toBuyItems = [];
    if (req.isAuthenticated()) {
      User.findOne({
        username: req.user.username
      }, function(err, founduser) {
        if (founduser) {
          availableItems = founduser.grocery;
        } else if (err) {
          res.redirect("/login");
        }
        for (var i = 0, j = 0; i < availableItems.length; i++) {
          if (availableItems[i].quantity == 0 || availableItems[i].numDaysToExpire <= 0) {
            var item = availableItems[i].itemName;
            var lastBought = availableItems[i].dateofBuying;
            var id = availableItems[i]._id;
            var k = 0;
            for (k = 0; k < availableItems.length; k++) {
              if (availableItems[k].itemName === item && availableItems[k].quantity > 0 && availableItems[k].numDaysToExpire > 0) {
                break;
              }
            }
            if (k === availableItems.length || availableItems[i].numDaysToExpire <= 0) {
              toBuyItems[j] = {
                _id: id,
                itemname: item,
                lastBought: lastBought,
                reason: ""
              };
              if (availableItems[i].quantity == 0) {
                toBuyItems[j].reason = "This item is all used. Get some more.";
              } else {
                toBuyItems[j].reason = "This item has crossed the expiry date. Don't use it.";
              }
              j++;
            }
          }
        }
        console.log(toBuyItems);
        res.render("toBuy", {
          toBuyItems: toBuyItems,
          helpers: date
        });
      });
    } else {
      res.redirect("/login");
    }
  })
  .post(function(req, res) {
    var tobeDeleted = req.body.delete;
    console.log(tobeDeleted);
    User.findOneAndUpdate({
      username: req.user.username
    }, {
      $pull: {
        grocery: {
          _id: tobeDeleted
        }
      }
    }, function(err) {
      if (!err) {
        console.log("Delete Successful");
        res.redirect("/toBuy");
      }
    });
  });

app.route("/logout")
  .get(function(req, res) {
    req.logout();
    res.redirect("/");
  })

app.route("/signin")
  .get(function(req, res) {
    res.render("signin");
  })
  .post(function(req, res) {
    User.register({
      name: req.body.name,
      username: req.body.username
    }, req.body.password, function(err, user) {
      if (err) {
        console.log(err);
        res.redirect("/signin");
      } else {
        passport.authenticate("local")(req, res, function() {
          res.redirect("/eatit");
        });
      }
    });
  });

app.route("/login")
  .get(function(req, res) {
    res.render("login");
  })
  .post(function(req, res) {
    const user = new User({
      username: req.body.username,
      password: req.body.password
    });

    req.login(user, function(err) {
      if (err) {
        console.log(err);
        res.redirect("/login");
      } else {
        passport.authenticate("local")(req, res, function() {
          res.redirect("/eatit");
        });
      }
    });
  });
app.listen(3000, function() {
  console.log("Server up and Running");
});
