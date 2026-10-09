import express from "express";
import dotenv from "dotenv";
import pg from "pg";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import sanitizeHtml from "sanitize-html";

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

function cleanIncomingHTML(rawContent) {
  if (!rawContent) return "";
  return rawContent
    .replace(/&nbsp;/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\r?\n|\r/g, " ")
    .replace(/\s+/g, " ");
}

const sanitizeOptions = {
  allowedTags: ["b", "i", "em", "strong", "u", "s", "strike", "h1", "h2", "h3", "p", "code", "blockquote", "ul", "ol", "li", "a", "br"],
  allowedAttributes: {
    a: ["href", "target", "rel"]
  }
};

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

//GET ROUTE TO FETCH USER PROFILE
app.get("/userProfile", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await db.query("SELECT * FROM users WHERE id = $1", [
      userId,
    ]);
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Failed to retrive user's profile: ", err.stack);
    res.status(500).json({ message: "Database connection error" });
  }
});

//PATCH ROUTE TO UPDATE USER PROFILE
app.patch("/userProfile", verifyToken, async (req, res) => {
  const { name, username, bio, email, github, instagram, linkedin } = req.body;
  const userId = req.user.id;

  try {
    const result = await db.query(
      `UPDATE users SET 
      name = COALESCE($1, name), 
      username = COALESCE($2, username), 
      bio = COALESCE($3, bio), 
      email = COALESCE($4, email), 
      github = COALESCE($5, github), 
      instagram = COALESCE($6, instagram),
      linkedin = COALESCE($7, linkedin)
      WHERE id = ($8) RETURNING name, email, username, bio, github, instagram, linkedin`,
      [name, username, bio, email, github, instagram, linkedin, userId],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({ message: "Email is already in use." });
    }
    console.error("Failed to update profile : ", err.stack);
    res.status(500).json({ message: "Database update Error" });
  }
});

//PATCH ROUTE TO UPDATE USER PASSWORD
app.patch("/password", verifyToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user.id;
  try {
    const result = await db.query(
      "SELECT password_hash FROM users WHERE id = $1",
      [userId],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found." });
    }
    const currentHash = result.rows[0].password_hash;
    const isMatch = await bcrypt.compare(oldPassword, currentHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid old password" });
    }

    const saltRounds = 10;
    const newHashedPassword = await bcrypt.hash(newPassword, saltRounds);
    await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      newHashedPassword,
      userId,
    ]);
    res.status(201).json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Failed to update passsword : ", err.stack);
    res.status(500).json({ message: "Database update Error" });
  }
});

//GET ROUTE TO FORWARD PUBLIC PROFILE DATA
app.get("/userProfile/:user_id", async (req, res) => {
  const user_id = parseInt(req.params.user_id, 10);
  if (isNaN(user_id)) {
    return res.status(400).json({ message: "Invalid user ID format." });
  }

  try {
    const userPromise = await db.query(
      `SELECT name, username, bio, created_at, github, instagram, linkedin FROM users WHERE id = $1`,
      [user_id],
    );

    const postsPromise = await db.query(
      `SELECT id, title, content, date FROM blogposts WHERE user_id = $1 ORDER BY id DESC`,
      [user_id],
    );

    const [userResult, postsResult] = await Promise.all([
      userPromise,
      postsPromise,
    ]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User profile not found" });
    }
    res.json({
      profile: userResult.rows[0],
      posts: postsResult.rows,
    });
  } catch (err) {
    console.error("Failed to fetch user profile: ", err.stack);
    res.status(500).json({ message: "Database fetch Error" });
  }
});

//GET ROUTE TO FORWARD DATA TO MY-POST PAGE
app.get("/myPosts", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const query = `
      SELECT 
        blogposts.id,
        blogposts.title,
        blogposts.content,
        blogposts.date,
        blogposts.user_id,
        users.username,
        COALESCE(users.name, users.username) AS display_name
      FROM blogposts
      LEFT JOIN users ON blogposts.user_id = users.id
      WHERE blogposts.user_id = $1 
      ORDER BY blogposts.id DESC
    `;
    const result = await db.query(query, [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error("Failed to retrive user's posts: ", err.stack);
    res.status(500).json({ message: "Database connection error" });
  }
});

//GET ROUTE TO FORWARD DATA TO BLOG PAGE
app.get("/posts", async (req, res) => {
  try {
    const query = `
        SELECT 
          blogposts.id,
          blogposts.title,
          blogposts.content,
          blogposts.date,
          blogposts.user_id,
          users.username,
          COALESCE(users.name, users.username) AS display_name
        FROM blogposts
        LEFT JOIN users ON blogposts.user_id = users.id
        ORDER BY blogposts.id DESC
      `;
    const result = await db.query(query);
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

  const normalized = cleanIncomingHTML(content);
  const cleanContent = sanitizeHtml(normalized || "", sanitizeOptions);

  try {
    const result = await db.query(
      "INSERT INTO blogposts (title, content, author, user_id) VALUES ($1, $2, $3, $4) RETURNING *",
      [title, cleanContent, author, userId],
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
    const query = `
      SELECT 
        blogposts.id,
        blogposts.title,
        blogposts.content,
        blogposts.date,
        blogposts.user_id,
        users.username,
        COALESCE(users.name, users.username) AS display_name
      FROM blogposts
      LEFT JOIN users ON blogposts.user_id = users.id
      WHERE blogposts.id = $1
    `;
    const result = await db.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Post not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Failed to fetch post: ", err.stack);
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

  const normalized = cleanIncomingHTML(content);
  const cleanContent = normalized !== undefined ? sanitizeHtml(normalized, sanitizeOptions) : undefined;

  try {
    const result = await db.query(
      "UPDATE blogposts SET title = COALESCE($1,title), content = COALESCE($2, content) WHERE id = $3 AND user_id = $4 RETURNING *",
      [title, cleanContent, id, userId],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Unauthorized: You do not own this post." });
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
      return res
        .status(404)
        .json({ message: "Unauthorized: You do not own this post." });
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
