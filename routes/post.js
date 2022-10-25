var express = require("express");
var router = express.Router();
var passportLocalMongoose = require("passport-local-mongoose");
const mongoose = require("mongoose");
const { stringify } = require("nodemon/lib/utils");

mongoose.connect("mongodb://localhost/d");
const postSchema = mongoose.Schema({
  post: String,
  username: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "d" },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "d" }],
  comments: [{ type: mongoose.Schema.Types.Mixed }],
});

postSchema.plugin(passportLocalMongoose);
module.exports = mongoose.model("post", postSchema);
