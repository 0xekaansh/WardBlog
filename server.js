import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.SERVER_PORT || 3000;
const API_URL = process.env.API_URL;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

//GET ROUTE TO HOMEPAGE
app.get("/", (req, res) => {
  res.render("homepage.ejs");
})

app.get("/login", (req, res) => {
  res.render("login.ejs");
})

app.get("/register", (req, res) => {
  res.render("register.ejs");
})

//GET ROUTE TO BLOG/FEED PAGE
app.get("/blogs", async (req, res) => {
  try {
    const response = await axios.get(`${API_URL}/posts`);
    res.render("blog.ejs", { posts: response.data });
  } catch (error) {
    res.status(500).json({ message: "Error fetching posts" });
  }
});

//GET ROUTE TO CREATEPOST PAGE
app.get("/new", (req, res) => {
  res.render("createPost.ejs", { heading: "New Post", submit: "Create Post" });
});

//POST ROUTE TO SUBMIT NEW BLOG
app.post("/api/posts", async (req, res) => {
  try {
    const response = await axios.post(`${API_URL}/posts`, req.body);
    res.redirect("/blogs");
  } catch (error) {
    res.status(500).json({ message: "Error creating post" });
  }
});

//GET ROUTE TO EDIT BLOG PAGE
app.get("/edit/:id", async (req, res) => {
  try {
    const response = await axios.get(`${API_URL}/posts/${req.params.id}`);
    res.render("createPost.ejs", {
      heading: "Edit Post",
      submit: "Update Post",
      post: response.data,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching Post" });
  }
});

//POST ROUTE TO EDITED BLOG
app.post("/api/posts/:id", async (req, res) => {
  try {
    const response = await axios.patch(
      `${API_URL}/posts/${req.params.id}`,
      req.body,
    );
    res.redirect("/blogs");
  } catch (error) {
    res.status(500).json({ message: "Error updating post" });
  }
});

//POST ROUTE TO DELETE BLOG
app.post("/api/posts/delete/:id", async (req, res) => {
  try {
    await axios.delete(`${API_URL}/posts/${req.params.id}`);
    res.redirect("/blogs");
  } catch (error) {
    res.status(500).json({ message: "Error deleting post" });
  }
});

app.listen(port, () => {
  console.log(`Backend server is running on http://localhost:${port}`);
});
