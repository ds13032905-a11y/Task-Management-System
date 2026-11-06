
import express from "express";
import mysql from "mysql2/promise";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MySQL Database Connection
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  waitForConnections: true,
  connectionLimit: 10
});

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET missing in .env");
}

// Test Database Connection
app.get("/", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.send("Task Manager API is running!");
  } catch (error) {
    console.error("Database Error:", error);
    res.status(500).send("Database connection failed");
  }
});

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Login required"
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        message: "Invalid or expired token"
      });
    }

    req.user = user;
    next();
  });
}

// REGISTER API
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must contain at least 6 characters"
      });
    }

    const [existing] = await db.execute(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: "Email already registered"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.execute(
      `INSERT INTO users (name, email, password)
       VALUES (?, ?, ?)`,
      [name, email, hashedPassword]
    );

    const token = jwt.sign(
      { id: result.insertId, email },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(201).json({
      message: "Registration successful",
      token,
      user: {
        id: result.insertId,
        name,
        email
      }
    });

  } catch (error) {
    console.error("Register Error:", error);

    res.status(500).json({
      message: "Registration failed"
    });
  }
});

// LOGIN API
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const [users] = await db.execute(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const user = users[0];

    const validPassword = await bcrypt.compare(
      password,
      user.password
    );

    if (!validPassword) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error("Login Error:", error);

    res.status(500).json({
      message: "Login failed"
    });
  }
});

// GET ALL TASKS
app.get("/api/tasks", authenticateToken, async (req, res) => {
  try {
    const [tasks] = await db.execute(
      `SELECT * FROM tasks
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(tasks);

  } catch (error) {
    console.error("Fetch Tasks Error:", error);

    res.status(500).json({
      message: "Unable to fetch tasks"
    });
  }
});

// CREATE TASK
app.post("/api/tasks", authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      priority,
      status,
      due_date
    } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({
        message: "Task title is required"
      });
    }

    const [result] = await db.execute(
      `INSERT INTO tasks
       (user_id, title, description, priority, status, due_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        title.trim(),
        description || "",
        priority || "Medium",
        status || "Pending",
        due_date || null
      ]
    );

    const [rows] = await db.execute(
      `SELECT * FROM tasks
       WHERE id = ? AND user_id = ?`,
      [result.insertId, req.user.id]
    );

    res.status(201).json(rows[0]);

  } catch (error) {
    console.error("Create Task Error:", error);

    res.status(500).json({
      message: "Unable to create task"
    });
  }
});

// UPDATE TASK
app.put("/api/tasks/:id", authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      priority,
      status,
      due_date
    } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({
        message: "Task title is required"
      });
    }

    const [result] = await db.execute(
      `UPDATE tasks
       SET title = ?,
           description = ?,
           priority = ?,
           status = ?,
           due_date = ?
       WHERE id = ? AND user_id = ?`,
      [
        title.trim(),
        description || "",
        priority || "Medium",
        status || "Pending",
        due_date || null,
        req.params.id,
        req.user.id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Task not found"
      });
    }

    const [rows] = await db.execute(
      `SELECT * FROM tasks
       WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );

    res.json(rows[0]);

  } catch (error) {
    console.error("Update Task Error:", error);

    res.status(500).json({
      message: "Unable to update task"
    });
  }
});

// DELETE TASK
app.delete("/api/tasks/:id", authenticateToken, async (req, res) => {
  try {
    const [result] = await db.execute(
      `DELETE FROM tasks
       WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Task not found"
      });
    }

    res.json({
      message: "Task deleted successfully"
    });

  } catch (error) {
    console.error("Delete Task Error:", error);

    res.status(500).json({
      message: "Unable to delete task"
    });
  }
});

// START SERVER
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
