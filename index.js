import express from "express";
import dotenv from "dotenv";
import pg from "pg";

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

//Homepage/data
app.get("/posts", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM blogposts ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("Failed to retrieve posts: ", err.stack);
    res.status(500).json({ message: "Database connection error" });
  }
});

//createPost-New-data
app.post("/posts", async (req, res) => {
  const { title, content, author } = req.body;
  try {
    const result = await db.query(
      "INSERT INTO blogposts (title, content, author) VALUES ($1, $2, $3) RETURNING *",
      [title, content, author],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("Failed to Insert Entered data : ", err.stack);
    res.status(500).json({ message: "Database Insertion Error" });
  }
});

//find-editPost-Id
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

//patch-editPost
app.patch("/posts/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid post ID format." });
  }

  const { title, content, author } = req.body;
  try {
    const result = await db.query(
      "UPDATE blogposts SET title = COALESCE($1,title), content = COALESCE($2, content), author = COALESCE($3, author) WHERE id = $4 RETURNING *",
      [title, content, author, id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Post not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Failed to update data: ", err.stack);
    res.status(500).json({ message: "Database update error" });
  }
});

//delete
app.delete("/posts/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid post ID format." });
  }

  try {
    const result = await db.query("DELETE FROM blogposts WHERE id = $1 RETURNING *", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Post not found" });
    }
    res.json({message: "Post deleted successfully"});
  } catch (err) {
    console.error("Failed to delete post: ", err.stack);
    res.status(500).json({ message: "Database deletion error" });
  }
});

app.listen(port, () => {
  console.log(`App listening on port: ${port}`);
});
