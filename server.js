const express = require("express");
const exphbs = require("express-handlebars");

//Github
const cookieParser = require("cookie-parser");
const expressSession = require("express-session");
const crypto = require("crypto");
const passport = require("passport");
const GithubStrategy = require("passport-github").Strategy;
const { stringify } = require("flatted");
const _ = require("underscore");
// import env variables
require("dotenv").config();

const { getWelcomeMessage, getPRFiles, getContent } = require("./Octokit");
const { session } = require("passport");

const app = express();
const port = process.env.PORT;
const COOKIE = process.env.PROJECT_DOMAIN;

// Create a cookie which will hold the saved authenticated user
app.use(cookieParser());

// Using crypto library to create a random string of secret value for the user's session in the browser
app.use(
  expressSession({
    secret: crypto.randomBytes(64).toString("hex"),
    resave: true,
    saveUninitialized: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let scopes = ["notifications", "user:email", "read:org", "repo"];

// Passport is authentication middleware for any Nodejs server application
// Here, we are using passport to define our authentication strategy with the github account
// i.e. defining how we are going to authenticate with github
passport.use(
  new GithubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/login/github/return",
      scope: scopes.join(" "),
    },
    function (token, tokenSecret, profile, cb) {
      return cb(null, { profile: profile, token: token });
    }
  )
);
passport.serializeUser(function (user, done) {
  done(null, user);
});
passport.deserializeUser(function (obj, done) {
  done(null, obj);
});
app.use(passport.initialize());
app.use(passport.session());

const hbs = exphbs.create({
  layoutsDir: __dirname + "/views",
});

app.engine("handlebars", hbs.engine);
app.set("views", __dirname + "/views");
app.set("view engine", "handlebars");

app.get("/", async (req, res) => {
  let data = {
    session: req.cookies[COOKIE] && JSON.parse(req.cookies[COOKIE]),
  };

  let githubData;
  // Check if session exists in browser
  if (data.session && data.session.token) {
    try {
      // Call github API here
      githubData = await getWelcomeMessage(data.session.token);
    } catch (error) {
      githubData = { error: error };
    }

    // Using the _ underscore library to create
    // a shallow copy of the github api response
    _.extend(data, githubData);
  } else if (data.session) {
    data.session.token = "mildly obfuscated.";
  }

  let token = data.session ? data.session.token : "Signed out";
  data.json = stringify(data, null, 2);

  res.render("main", {
    username: githubData,
    token: token,
  });
});

app.get("/pr", async (req, res) => {
  let session = req.cookies[COOKIE] && JSON.parse(req.cookies[COOKIE]);

  // Check if session exists in browser
  if (session && session.token) {
    try {
      let resp;
      // Call github API here
      resp = await getPRFiles(session.token);
      resp = await JSON.stringify(resp, undefined, 2);

      res.render("main", {
        pr: resp,
        token: session.token,
      });
    } catch (error) {
      res.render("main", {
        error: error,
        token: session.token,
      });
    }
  }
});

app.get("/getcontent", async (req, res) => {
  let session = req.cookies[COOKIE] && JSON.parse(req.cookies[COOKIE]);

  // Check if session exists in browser
  if (session && session.token) {
    try {
      let resp;
      // Call github API here
      resp = await getContent(session.token);
      resp = await JSON.stringify(resp, undefined, 2);

      res.render("main", {
        content: resp,
        token: session.token,
      });
    } catch (error) {
      res.render("main", {
        error: error,
        token: session.token,
      });
    }
  }
});

// /logoff clear the cookie from the browser session as well as redirect the user to the home or initial route
app.get("/logoff", function (req, res) {
  res.clearCookie(COOKIE);
  res.redirect("/");
});

// /auth/github to authenticate the user using passport strategy
app.get("/auth/github", passport.authenticate("github"));

// /login/github/return is the callback URL. On success, it will create the cookie with user authorization data, and on failure, it will redirect to the initial route
app.get(
  "/login/github/return",
  passport.authenticate("github", {
    successRedirect: "/setcookie",
    failureRedirect: "/",
  })
);

// /setcookie on successful auth, this route will store the user profile detail and token
app.get("/setcookie", function (req, res) {
  let data = {
    user: req.session.passport.user.profile._json,
    token: req.session.passport.user.token,
  };
  res.cookie(COOKIE, JSON.stringify(data));
  res.redirect("/");
});

app.listen(port, () => {
  console.log(`🌏 Server is running at http://localhost:${port}`);
});
