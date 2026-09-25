import express from "express";
import dotenv from "dotenv";
import pg from "pg";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

dotenv.config();

const app = express();
const port = process.env.APP_PORT || 4000;

const db = new pg.Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

//JWT VERIFICATION MIDDLEWARE
function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Access Denied. Please log in." });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decodedUser) => {
    if (err) {
      return res.status(403).json({ message: "Invalid or expired token." });
    }
    req.user = decodedUser;
    next();
  });
}

//AUTHENTICATION ROUTES

//POST ROUTE TO REGISTER
app.post("/auth/register", async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const result = await db.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email",
      [username, email, hashedPassword],
    );
    const user = result.rows[0];

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.status(201).json({ token, user });
  } catch (err) {
    if (err.code === "23505") {
      return res
        .status(400)
        .json({ message: "Username or email is already taken." });
    }
    console.error("Registration error: ", err.stack);
    res.status(500).json({ message: "Registration failed." });
  }
});

//POST ROUTE TO LOGIN
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid email or password." });
    }
    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (err) {
    console.log("Login error: ", err.stack);
    res.status(500).json({ message: "Login Failed" });
  }
});

//GET ROUTE TO FORWARD DATA TO BLOG PAGE
app.get("/posts", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM blogposts ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("Failed to retrieve posts: ", err.stack);
    res.status(500).json({ message: "Database connection error" });
  }
});

//POST ROUTE TO SUBMIT NEW BLOG FOR ONLY LOGGED IN USERS
app.post("/posts", verifyToken, async (req, res) => {
  const { title, content } = req.body;
  const author = req.user.username;
  const userId = req.user.id;

  try {
    const result = await db.query(
      "INSERT INTO blogposts (title, content, author, user_id) VALUES ($1, $2, $3, $4) RETURNING *",
      [title, content, author, userId],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Failed to Insert Entered data : ", err.stack);
    res.status(500).json({ message: "Database Insertion Error" });
  }
});

//GET ROUTE TO FIND SELECTED BLOG TO EDIT
app.get("/posts/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid post ID format." });
  }
  try {
    const result = await db.query("SELECT * FROM blogposts WHERE id = $1", [
      id,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Post not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.log("Failed to fetch post: ", err.stack);
    res.status(500).json({ message: "Database fetch Error" });
  }
});

//PATCH ROUTE TO SUBMIT EDITED BLOG FOR LOGGED IN USERS ONLY
app.patch("/posts/:id", verifyToken, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid post ID format." });
  }

  const { title, content } = req.body;
  const userId = req.user.id;

  try {
    const result = await db.query(
      "UPDATE blogposts SET title = COALESCE($1,title), content = COALESCE($2, content) WHERE id = $3 AND user_id = $4 RETURNING *",
      [title, content, id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Unauthorized: You do not own this post." });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Failed to update data: ", err.stack);
    res.status(500).json({ message: "Database update error" });
  }
});

//DELETE ROUTE TO DELETE SELECTED BLOG FOR LOGGED IN USER ONLY
app.delete("/posts/:id", verifyToken, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid post ID format." });
  }

  const userId = req.user.id;

  try {
    const result = await db.query(
      "DELETE FROM blogposts WHERE id = $1 AND user_id = $2 RETURNING *",
      [id, userId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Unauthorized: You do not own this post." });
    }
    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    console.error("Failed to delete post: ", err.stack);
    res.status(500).json({ message: "Database deletion error" });
  }
});

app.listen(port, () => {
  console.log(`API listening on port: ${port}`);
});
