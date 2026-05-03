require("dotenv").config();

const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const bcrypt = require("bcrypt");
const Joi = require("joi");
const { MongoClient } = require("mongodb");


const app = express();

app.use(express.urlencoded({ extended: true }));

const path = require("path");

app.use(express.static(path.join(__dirname, "pictures")));


const mongoUrl = `mongodb+srv://${process.env.MONGODB_USER}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_HOST}/${process.env.MONGODB_DATABASE}?retryWrites=true&w=majority`;

/*
client server
*/
const client = new MongoClient(mongoUrl);
let users;

/*
confirm connect w/ console
*/
async function init() {
  await client.connect();
  const db = client.db();
  users = db.collection("users");
  console.log("Connected to MongoDB");
}
init();

// Sessions
app.use(
  session({
    secret: process.env.NODE_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: mongoUrl,
    }),
    cookie: {
      maxAge: 1000 * 60 * 60, // 1 hour
    },
  })
);

/*
joi for input check
*/
const signupSchema = Joi.object({
  name: Joi.string().min(1).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

/*
home page
*/
app.get("/", (req, res) => {
  res.send(`
    <h1>Home</h1>
    <a href="/signup"><button>Sign Up</button></a>
    <a href="/login"><button>Log In</button></a>
  `);
});

/*
sign up page
*/
app.get("/signup", (req, res) => {
  res.send(`
    <h1>Sign Up</h1>
    <form method="POST" action="/signup">
      <input name="name" placeholder="Name"/><br/>
      <input name="email" placeholder="Email"/><br/>
      <input name="password" type="password" placeholder="Password"/><br/>
      <button>Sign Up</button>
    </form>
  `);
});

/*
check input for sign up and print appropriate response
*/
app.post("/signup", async (req, res) => {
  const { error, value } = signupSchema.validate(req.body);

  if (error) return res.send("Invalid input");

  const { name, email, password } = value;

  const existingUser = await users.findOne({ email });
  if (existingUser) return res.send("User already exists");

  const hashedPassword = await bcrypt.hash(password, 10);

  await users.insertOne({
    name,
    email,
    password: hashedPassword,
  });

  req.session.user = { name };

  res.redirect("/members");
});

/*
login page
*/
app.get("/login", (req, res) => {
  res.send(`
    <h1>Login</h1>
    <form method="POST" action="/login">
      <input name="email" placeholder="Email"/><br/>
      <input name="password" type="password" placeholder="Password"/><br/>
      <button>Login</button>
    </form>
  `);
});

/*
check login input and print appropriate response
*/
app.post("/login", async (req, res) => {
  const { error, value } = loginSchema.validate(req.body);

  if (error) return res.send("Invalid input");

  const { email, password } = value;

  const user = await users.findOne({ email });
  if (!user) return res.send("No user found");

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.send("Incorrect password");

  req.session.user = { name: user.name };

  res.redirect("/members");
});

/*
actual page, gets images from pictures folder, dsiplays 1 randomly
*/
app.get("/members", (req, res) => {
  if (!req.session.user) return res.redirect("/");

  const images = ["A1.png", "A12.png", "AA.png"];
  const randomImage = images[Math.floor(Math.random() * images.length)];

  res.send(`
    <h1>Welcome ${req.session.user.name}</h1>
    <img src="/${randomImage}" style="max-width:300px; display:block; margin-top:20px;" />
    <br />
    <a href="/logout">Logout</a>
  `);
});

/*
kill session on logout
*/
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

/*
check if running, print port
*/
app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});