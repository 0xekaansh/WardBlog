import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const port = process.env.SERVER_PORT || 3000;
const API_URL = process.env.API_URL || "http://localhost:4000";

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

//GLOBAL MIDDLEWARE: DECODES TOKEN TO POPULATE 'currentUser'
app.use((req, res, next) => {
  const token = req.cookies?.token;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      res.locals.currentUser = decoded;
    } catch (err) {
      res.clearCookie("token");
      res.locals.currentUser = null;
    }
  } else {
    res.locals.currentUser = null;
  }
  next();
});

//REDIRECTS GUESTS TO LOGIN
function requireAuth(req, res, next) {
  if (!res.locals.currentUser) {
    return res.redirect("/login");
  }
  next();
}

//GET ROUTE TO HOMEPAGE
app.get("/", (req, res) => {
  res.render("homepage.ejs");
});

//REGISTER PAGES
app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.post("/register", async (req, res) => {
  try {
    const response = await axios.post(`${API_URL}/auth/register`, req.body);
    res.cookie("token", response.data.token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.redirect("/blogs");
  } catch (error) {
    const errorMsg = error.response?.data?.message || "Registration failed";
    res.render("register.ejs", { error: errorMsg });
  }
});

//LOGIN PAGES
app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.post("/login", async (req, res) => {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, req.body);
    res.cookie("token", response.data.token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.redirect("/blogs");
  } catch (error) {
    const errorMsg = error.response?.data?.message || "Login failed";
    res.render("login.ejs", { error: errorMsg });
  }
});

//LOGOUT
app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/");
});

//GET ROUTE TO BLOG/FEED PAGE
app.get("/blogs", async (req, res) => {
  try {
    const response = await axios.get(`${API_URL}/posts`);
    res.render("blog.ejs", { posts: response.data });
  } catch (error) {
    res.status(500).json({ message: "Error fetching posts" });
  }
});

//GET ROUTE TO CREATEPOST PAGE FOR LOGGED IN USER ONLY
app.get("/new", requireAuth, (req, res) => {
  res.render("createPost.ejs", { heading: "New Post", submit: "Create Post" });
});

//POST ROUTE TO SUBMIT NEW BLOG FOR LOGGED IN USER ONLY
app.post("/api/posts", requireAuth, async (req, res) => {
  try {
    const response = await axios.post(`${API_URL}/posts`, req.body, {
      headers: { Authorization: `Bearer ${req.cookies.token}` },
    });
    res.redirect("/blogs");
  } catch (error) {
    res.status(500).json({ message: "Error creating post" });
  }
});

//GET ROUTE TO EDIT BLOG PAGE FOR LOGGED IN USER ONLY
app.get("/edit/:id", requireAuth, async (req, res) => {
  try {
    const response = await axios.get(`${API_URL}/posts/${req.params.id}`);
    const post = response.data;

    if (post.user_id !== res.locals.currentUser.id) {
      return res.redirect("/blogs");
    }
    res.render("createPost.ejs", {
      heading: "Edit Post",
      submit: "Update Post",
      post: post,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching Post" });
  }
});

//POST ROUTE TO EDITED BLOG FOR LOGGED IN USER ONLY
app.post("/api/posts/:id", requireAuth, async (req, res) => {
  try {
    const response = await axios.patch(
      `${API_URL}/posts/${req.params.id}`,
      req.body,
      { headers: { Authorization: `Bearer ${req.cookies.token}` } },
    );
    res.redirect("/blogs");
  } catch (error) {
    res.status(500).json({ message: "Error updating post" });
  }
});

//POST ROUTE TO DELETE BLOG
app.post("/api/posts/delete/:id", requireAuth, async (req, res) => {
  try {
    await axios.delete(`${API_URL}/posts/${req.params.id}`, {
      headers: { Authorization: `Bearer ${req.cookies.token}` },
    });
    res.redirect("/blogs");
  } catch (error) {
    res.status(500).json({ message: "Error deleting post" });
  }
});

app.listen(port, () => {
  console.log(`Frontend server is running on http://localhost:${port}`);
});
