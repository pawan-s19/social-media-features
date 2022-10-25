var express = require("express");
var passportLocal = require("passport-local");
const { UserExistsError } = require("passport-local-mongoose/lib/errors");
const { Passport } = require("passport/lib");
const passport = require("passport");
const fs = require("fs");
const users = require("./users");
const post = require("./post");
var expressSession = require("express-session");
const { route } = require("express/lib/application");
const multer = require("multer");
const res = require("express/lib/response");
passport.use(new passportLocal(users.authenticate()));
var router = express.Router();
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
      cb(null, "./public/images/uploads");
    } else {
      cb("image with only jpeg and png extensions are allowed");
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix =
      Date.now() + "-" + Math.round(Math.random() * 1e9) + file.originalname;
    cb(null, file.fieldname + "-" + uniqueSuffix);
  },
});

const upload = multer({ storage: storage });

router.post(
  "/upload",
  isLoggedIn,
  upload.single("image"),
  async function (req, res) {
    var user = await users.findOne({ username: req.session.passport.user });
    user.profilePic = `/images/uploads/${req.file.filename}`;
    await user.save();
    res.redirect("/profile");
  }
);

router.get("/", function (req, res, next) {
  res.render("index.ejs");
});

router.post("/register", function (req, res) {
  var newUser = new users({
    username: req.body.username,
    name: req.body.name,
  });
  users
    .register(newUser, req.body.password)
    .then(function (u) {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/");
      });
    })
    .catch(function (err) {
      res.send(err.message);
    });
});

router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/profile",
    failureRedirect: "/",
  }),
  function (req, res) {}
);

function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    res.redirect("/");
  }
}

router.get("/logout", function (req, res) {
  req.logOut;
  res.redirect("/");
});
module.exports = router;

router.get("/profile", isLoggedIn, async function (req, res) {
  var lusr = await users.findOne({ username: req.session.passport.user });
  var data = await lusr.populate("post");
  res.render("profile.ejs", { lusr, data });
});

router.get("/edit", isLoggedIn, function (req, res) {
  users.findOne({ username: req.session.passport.user }).then(function (data) {
    res.render("update.ejs", { data });
  });
});

router.post("/update/:plc", isLoggedIn, function (req, res) {
  users
    .findOneAndUpdate({ _id: req.params.plc }, { name: req.body.name })
    .then(function () {
      res.redirect("/profile");
    });
});

router.post("/post", isLoggedIn, function (req, res) {
  users.findOne({ username: req.session.passport.user }).then(function (data) {
    post
      .create({
        post: req.body.tarea,
        username: req.session.passport.user,
        userId: data._id,
      })
      .then(function (post) {
        data.post.push(post._id);
        data.save().then(function () {
          res.redirect(req.headers.referer);
        });
      });
  });
});

router.get("/delete/:plc", isLoggedIn, function (req, res) {
  post.findOneAndDelete({ _id: req.params.plc }).then(function () {
    res.redirect("/profile");
  });
});

router.get("/like/:plc", isLoggedIn, function (req, res) {
  users.findOne({ username: req.session.passport.user }).then(function (user) {
    post.findOne({ _id: req.params.plc }).then(function (post) {
      if (post.likes.indexOf(user._id) === -1) {
        post.likes.push(user._id);
      } else {
        post.likes.splice(post.likes.indexOf(user._id), 1);
      }
      post.save().then(function () {
        user.save().then(function () {
          res.redirect(req.headers.referer);
        });
      });
    });
  });
});

router.post("/comment/:postId", isLoggedIn, function (req, res) {
  users
    .findOne({ username: req.session.passport.user })
    .then(function (foundUser) {
      post.findOne({ _id: req.params.postId }).then(function (foundPost) {
        foundPost.comments.push({
          username: req.session.passport.user,
          comment: req.body.comment,
        });

        foundPost.save().then(function (savedPost) {
          res.redirect(req.headers.referer);
          console.log(savedPost);
        });
      });
    });
});

router.get("/feed", isLoggedIn, function (req, res) {
  post
    .find({})
    .populate("userId")
    .populate("likes")
    .then(function (allPosts) {
      users
        .findOne({ username: req.session.passport.user })
        .then(function (loggedInUser) {
          res.render("feed.ejs", {
            allPosts,
            loggedInUser,
          });
        });
    });
});

router.post("/reply/:plc", isLoggedIn, async function (req, res) {
  res.send("under construction");
});
router.get("/allUsers", function (req, res) {
  users.find({}).then(function (allUsers) {
    users
      .findOne({ username: req.session.passport.user })
      .then(function (loggedInUser) {
        res.render("users.ejs", { allUsers, loggedInUser });
      });
  });
});
router.get("/sendRequest/:plc", (req, res) => {
  users
    .findOne({ username: req.session.passport.user })
    .then(function (loggedInUser) {
      users.findOne({ _id: req.params.plc }).then(function (reciepent) {
        if (reciepent.pendingFriendRequests.indexOf(loggedInUser.id) === -1) {
          if (loggedInUser.friends.indexOf(reciepent.id) === -1) {
            reciepent.pendingFriendRequests.push(loggedInUser.id);
            reciepent.save().then(function (saved) {});
          }
        }
        if (loggedInUser.requestSent.indexOf(req.params.plc) === -1) {
          loggedInUser.requestSent.push(req.params.plc);
          loggedInUser.save().then(function (sr) {});
        }
        res.redirect(req.headers.referer);
      });
    });
});
router.get("/pendingrequests", (req, res) => {
  users
    .findOne({ username: req.session.passport.user })
    .populate("pendingFriendRequests")
    .then(function (loggedInUser) {
      res.render("pfr.ejs", { loggedInUser });
    });
});
router.get("/accept/:plc", (req, res) => {
  users
    .findOne({ username: req.session.passport.user })
    .then(function (loggedInUser) {
      users.findOne({ _id: req.params.plc }).then(function (sender) {
        if (loggedInUser.friends.indexOf(req.params.plc) === -1) {
          loggedInUser.friends.push(req.params.plc);
        }
        let index = loggedInUser.pendingFriendRequests.indexOf(req.params.plc);
        loggedInUser.pendingFriendRequests.splice(index, 1);
        let index5 = loggedInUser.requestSent.indexOf(sender.id);
        loggedInUser.requestSent.splice(index5, 1);
        loggedInUser.save().then(function (savedLoggedInUser) {
          if (sender.friends.indexOf(loggedInUser.id) === -1) {
            sender.friends.push(loggedInUser.id);
          }
          if (sender.requestSent.indexOf(loggedInUser.id) != -1) {
            let index3 = sender.requestSent.indexOf(loggedInUser.id);
            sender.requestSent.splice(index3, 1);
          }
          let index4 = sender.pendingFriendRequests.indexOf(loggedInUser.id);
          sender.pendingFriendRequests.splice(index4, 1);
          sender.save().then(function (savedsender) {});
          res.redirect(req.headers.referer);
        });
      });
    });
});
router.get("/friends", (req, res) => {
  users
    .findOne({ username: req.session.passport.user })
    .populate("friends")
    .then(function (loggedInUser) {
      res.render("friends.ejs", { loggedInUser });
    });
});
router.get("/remove/:plc", (req, res) => {
  users
    .findOne({ username: req.session.passport.user })
    .then(function (loggedInUser) {
      let index = loggedInUser.friends.indexOf(req.params.plc);
      loggedInUser.friends.splice(index, 1);
      loggedInUser.save().then(function (saved) {
        users.findOne({ _id: req.params.plc }).then(function (removedUser) {
          let index2 = removedUser.friends.indexOf(saved.id);
          removedUser.friends.splice(index2, 1);
          removedUser.save().then(function (saved2) {});
          res.redirect(req.headers.referer);
        });
      });
    });
});
router.get("/undo/:plc", (req, res) => {
  users
    .findOne({ username: req.session.passport.user })
    .then(function (loggedInUser) {
      users.findOne({ _id: req.params.plc }).then(function (receipent) {
        let index = loggedInUser.requestSent.indexOf(req.params.plc);
        if (loggedInUser.requestSent.indexOf(req.params.plc) != -1) {
          loggedInUser.requestSent.splice(index, 1);
          loggedInUser.save().then(function (saved) {});
        }
        if (receipent.pendingFriendRequests.indexOf(loggedInUser.id) != -1) {
          receipent.pendingFriendRequests.splice(loggedInUser.id);
          receipent.save().then(function (saved) {});
        }
        res.redirect(req.headers.referer);
      });
    });
});
router.get("/sentRequests", (req, res) => {
  users
    .findOne({ username: req.session.passport.user })
    .populate("requestSent")
    .then(function (loggedInUser) {
      res.render("sentrequests.ejs", { loggedInUser });
    });
});
