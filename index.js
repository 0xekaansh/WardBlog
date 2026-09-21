import express, { json } from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.APP_PORT || 4000;

//just for functionality will add postresql later
let posts = [
  {
    id: 1,
    title: "The Rise of Decentralized Finance",
    content:
      "Decentralized Finance (DeFi) is an emerging and rapidly evolving field in the blockchain industry. It refers to the shift from traditional, centralized financial systems to peer-to-peer finance enabled by decentralized technologies built on Ethereum and other blockchains. With the promise of reduced dependency on the traditional banking sector, DeFi platforms offer a wide range of services, from lending and borrowing to insurance and trading.",
    author: "Alex Thompson",
    date: "2023-08-01T10:00:00Z",
  },
  {
    id: 2,
    title: "The Impact of Artificial Intelligence on Modern Businesses",
    content:
      "Artificial Intelligence (AI) is no longer a concept of the future. It's very much a part of our present, reshaping industries and enhancing the capabilities of existing systems. From automating routine tasks to offering intelligent insights, AI is proving to be a boon for businesses. With advancements in machine learning and deep learning, businesses can now address previously insurmountable problems and tap into new opportunities.",
    author: "Mia Williams",
    date: "2023-08-05T14:30:00Z",
  },
  {
    id: 3,
    title: "Sustainable Living: Tips for an Eco-Friendly Lifestyle",
    content:
      "Sustainability is more than just a buzzword; it's a way of life. As the effects of climate change become more pronounced, there's a growing realization about the need to live sustainably. From reducing waste and conserving energy to supporting eco-friendly products, there are numerous ways we can make our daily lives more environmentally friendly. This post will explore practical tips and habits that can make a significant difference.",
    author: "Samuel Green",
    date: "2023-08-10T09:15:00Z",
  },
];

let lastId = 3;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

//Homepage/data
app.get("/posts", (req, res) => {
  res.json(posts);
});

//createPost-New-data
app.post("/posts", (req, res) => {
  const newPost = {
    id: (lastId += 1),
    title: req.body.title,
    content: req.body.content,
    author: req.body.author,
    date: new Date(),
  };
  posts.push(newPost);
  res.status(201).json(newPost);
});

//find-editPost-Id
app.get("/posts/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const findPost = posts.find((post) => post.id === id);
  if (!findPost) return res.status(404).json({ message: "Post not found" });
  res.json(findPost);
});

//patch-editPost
app.patch("/posts/:id", (req, res) => {
  const patchedPost = posts.find((post) => post.id === parseInt(req.params.id));
  if (!patchedPost) return res.status(404).json({ message: "Post not Found" });
  if (req.body.title) patchedPost.title = req.body.title;
  if (req.body.content) patchedPost.content = req.body.content;
  if (req.body.author) patchedPost.author = req.body.author;
  res.json(patchedPost);
});

app.listen(port, () => {
  console.log(`App listening on port: ${port}`);
});
