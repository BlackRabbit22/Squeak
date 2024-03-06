const fs = require("fs");
const fsPromises = require("fs").promises;
let path = require("path");
const https = require("https");
const express = require("express");
let mustache = require("mustache-express");
const readFileSync = fs.readFileSync;
const app = express();
let crypto = require("crypto");
const { pbkdf2Sync } = require("node:crypto");
const cookieParser = require("cookie-parser");

//active sessions
let activeSessions = {};

//sets session cookie and registers session UUID
const setCookie = (username, res) => {
  let time = new Date().getTime();
  let sessionID = crypto.randomUUID();
  let sessionAge = 15; //in minutes
  let csrf_token = crypto.randomBytes(32).toString("hex");
  activeSessions[sessionID] = {
    username: username,
    sessionAge: time + sessionAge * 60000,
    token: csrf_token,
  };

  value = { sessionID: sessionID, username: username };
  res.cookie("squeak-session", value, {
    maxAge: sessionAge * 60000,
    httpOnly: true,
    secure: true,
    sameSite: "strict",
  });
};

//verifies whether session and session cookie exists
const verifySession = (req, res, next) => {
  let time = new Date().getTime();
  sessionCookie = req.cookies["squeak-session"];
  if (sessionCookie !== undefined) {
    sessionToken = sessionCookie.sessionID;

    //verifies if cookie and session exists and that time is proper
    if (sessionToken in activeSessions && activeSessions[sessionToken].sessionAge > time) {
      req.session = req.cookies["squeak-session"];
      next();
    } else {
      //if cookie exists but session doesn't exist
      removeCookie(req, res);
      res.sendFile(__dirname + "/templates/signin.html");
    }
  } else {
    //if no cookie exists
    res.sendFile(__dirname + "/templates/signin.html");
  }
};

//removes cookie
const removeCookie = (req, res) => {
  //if session exists, remove session
  if (req.session) {
    let sessionToken = req.session.sessionID;
    delete activeSessions[sessionToken];
  }
  res.clearCookie("squeak-session");
};

//Loads file asynchronously and contains options to replace parts of the returned data
const loadFile = async (file, replace = "", replace2 = "") => {
  try {
    const fPath = path.join(__dirname, file);
    const data = await fsPromises.readFile(fPath, "utf8");
    return data.replace(replace, replace2);
  } catch (err) {
    console.log(err);
  }
};

//Writes to file asynchronously
const writeToFile = async (file, data) => {
  try {
    const fPath = path.join(__dirname, file);
    await fsPromises.writeFile(fPath, data);
  } catch (err) {
    console.log(err);
  }
};

//Verifies whether username and password are proper upon signing up
const verifySignUp = (username, password, db) => {
  let validUsername = username !== undefined && !(username in db);
  let validPassword = password !== undefined && password.length >= 8;
  if (validUsername) {
    if (validPassword) {
      validPassword &= !password.includes(username);
      if (validPassword) {
        return "valid";
      }
      return "invalid-password";
    }
    return "invalid-password";
  }
  return "invalid-username";
};

//creates user account and returns if account is valid or not
const createAccount = async (username, password) => {
  const db = JSON.parse(await loadFile("/passwd"));
  let validity = verifySignUp(username, password, db);
  if (validity === "valid") {
    let [hashedPassword, salt] = hashPassword(password);
    db[username] = { hashedPassword, salt };
    await writeToFile("/passwd", JSON.stringify(db));
    return validity;
  }
  return validity;
};

//hashes password with a random 32 long byte salt
const hashPassword = (password, salt = "") => {
  if (!salt) {
    salt = crypto.randomBytes(32).toString("hex");
    let passwordHash = pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");

    return [passwordHash, salt];
  }
  let passwordHash = pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return passwordHash;
};

//compares password to hashed password in db
const verifyHash = (password, hash, salt) => {
  passwordHash = hashPassword(password, salt);

  return passwordHash === hash;
};

//verifies login information
const verifyLogin = async (userName, password) => {
  const userTable = JSON.parse(await loadFile("/passwd"));
  if (userName in userTable && password !== undefined) {
    hash = userTable[userName].hashedPassword;
    salt = userTable[userName].salt;

    return verifyHash(password, hash, salt);
  }
  //if user doesn't exist, return false
  return false;
};

//adds user submission to db
const uploadPost = async (username, submission) => {
  const submissions = JSON.parse(await loadFile("/squeaks"));
  let dateObj = new Date();
  let day = dateObj.toLocaleString("en-us", { weekday: "short" });
  let time = dateObj.getHours() + ":" + dateObj.getMinutes();
  let postNum = Object.keys(submissions).length + 1;
  submissions[postNum] = {
    username: username,
    submission: submission,
    timeStamp: day + " " + time,
  };
  await writeToFile("/squeaks", JSON.stringify(submissions));
};

//loads users submissions
const loadSubmissions = async () => {
  let submissions = JSON.parse(await loadFile("/squeaks"));

  return Object.values(submissions).reverse();
};

//middleware for verifying the referer
const verifyOrigin = (req, res, next) => {
  let domains = ["https://localhost:8000/"];

  if (domains.includes(req.headers.referer)) {
    next();
  } else {
    res.status(403).end();
  }
};

//middleware for verifying token
const verifyToken = (req, res, next) => {
  if (activeSessions[req.session.sessionID].token === req.body.token) {
    next();
  } else {
    res.status(403).end();
  }
};

//TLS cert and key file
const options = {
  key: readFileSync(__dirname + "/cert/key.pem"),
  cert: readFileSync(__dirname + "/cert/cert.pem"),
};

https.createServer(options, app).listen(8000);
app.engine("html", mustache());
app.set("view engine", "html");
app.set("views", __dirname + "/templates");
app.use(express.static(__dirname + "/public"));
app.use(express.json());
app.use(cookieParser());
app.use(
  express.urlencoded({
    extended: true,
  })
);

//route to main page
app.get("/", verifySession, (req, res) => {
  (async () => {
    let sessionID = req.session.sessionID;
    let username = req.session.username;
    let csrf_token = activeSessions[sessionID].token;
    (async () => {
      let data = await loadSubmissions();
      res.render("index", { token: csrf_token, user: username, squeaks: data });
    })();
  })();
});

app.post("/signin", verifyOrigin, (req, res) => {
  let username = req.body.username;
  let password = req.body.password;
  (async () => {
    credVerification = await verifyLogin(username, password);

    if (credVerification) {
      setCookie(username, res);
      res.send(credVerification);
    } else {
      res.send(credVerification);
    }
  })();
});

app.post("/signup", verifyOrigin, (req, res) => {
  let username = req.body.username;
  let password = req.body.password;
  (async () => {
    let credVerification = await createAccount(username, password);
    if (credVerification === "invalid-username" || credVerification === "invalid-password") {
      res.send(credVerification);
    } else if (credVerification === "valid") {
      setCookie(username, res);
      res.send(credVerification);
    }
  })();
});

app.post("/signout", verifyOrigin, verifySession, verifyToken, (req, res) => {
  removeCookie(req, res);
});

app.post("/squeak", verifyOrigin, verifySession, verifyToken, (req, res) => {
  let submission = req.body.squeak;
  let sessionID = req.session.sessionID;
  let username = activeSessions[sessionID].username;
  if (submission !== "") {
    uploadPost(username, submission);
    res.send(true);
  } else {
    res.send(false);
  }
});

app.use((req, res, next) => {
  res.status(404).send("<h1>404<br>Page not found!<h1>");
});
