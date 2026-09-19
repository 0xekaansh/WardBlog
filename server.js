import express from "express";
import axios from "axios";
import dotenv, { config } from "dotenv";

dotenv.config();

const app = express();
const port = process.env.SERVER_PORT || 3000;
const API_URL = process.env.API_URL;

app.use(express.static("public"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/", async (req, res) => {
  try {
    const response = await axios.get(`${API_URL}/posts`);
    res.render("blog.ejs", { posts: response.data });
  } catch (error) {
    res.status(500).json({ message: "Error fetching posts" });
  }
});


app.listen(port, () => {
    console.log(`Backend server is running on http://localhost:${port}`);
  });
