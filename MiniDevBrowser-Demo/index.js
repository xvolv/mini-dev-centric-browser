const express = require("express");
const cors = require("cors");
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// In-memory database
let users = [
  {
    id: 1,
    name: "User One",
    username: "userone",
    email: "userone@example.com",
  },
  {
    id: 2,
    name: "User Two",
    username: "usertwo",
    email: "usertwo@example.com",
  },
];

let nextId = 3;

// Log all requests
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.url}`);
  next();
});

// GET /api/users - Get all users
app.get("/api/users", (req, res) => {
  res.json(users);
});

// GET /api/users/:id - Get single user (THIS WAS MISSING!)
app.get("/api/users/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const user = users.find((u) => u.id === id);

  if (!user) {
    return res.status(404).json({ error: `User ${id} not found` });
  }

  res.json(user);
});

// POST /api/users - Create user
app.post("/api/users", (req, res) => {
  const newUser = { id: nextId++, ...req.body };
  users.push(newUser);
  res.status(201).json(newUser);
});

// PUT /api/users/:id - Update user
app.put("/api/users/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const index = users.findIndex((u) => u.id === id);

  if (index === -1) {
    return res.status(404).json({ error: `User ${id} not found` });
  }

  users[index] = { id, ...req.body };
  res.json(users[index]);
});

// DELETE /api/users/:id - Delete user
app.delete("/api/users/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const index = users.findIndex((u) => u.id === id);

  if (index === -1) {
    return res.status(404).json({ error: `User ${id} not found` });
  }

  users.splice(index, 1);
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`\nTest these endpoints:`);
  console.log(`  GET    http://localhost:${PORT}/api/users`);
  console.log(`  GET    http://localhost:${PORT}/api/users/1  ← NOW WORKS`);
  console.log(`  POST   http://localhost:${PORT}/api/users`);
  console.log(`  PUT    http://localhost:${PORT}/api/users/1`);
  console.log(`  DELETE http://localhost:${PORT}/api/users/1`);
});
