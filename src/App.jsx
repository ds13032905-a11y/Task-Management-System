import { useEffect, useMemo, useState } from "react";
import {
  Plus, Search, LayoutDashboard, CheckCircle2,
  Clock3, ListTodo, LogOut, Pencil, Trash2,
  X, CalendarDays, Flag, Menu
} from "lucide-react";
import "./App.css";

const API = "http://localhost:5000/api";

const emptyTask = {
  title: "",
  description: "",
  priority: "Medium",
  status: "Pending",
  due_date: ""
};

export default function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("taskToken") || ""
  );

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("taskUser")) || null;
    } catch {
      return null;
    }
  });

  const [authMode, setAuthMode] = useState("login");
  const [authData, setAuthData] = useState({
    name: "",
    email: "",
    password: ""
  });

  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState(emptyTask);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);

  async function request(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        logout();
      }
      throw new Error(data.message || "Something went wrong");
    }

    return data;
  }

  async function loadTasks() {
    if (!token) return;

    try {
      setLoading(true);
      const data = await request("/tasks");
      setTasks(data);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) loadTasks();
  }, [token]);

  async function handleAuth(e) {
    e.preventDefault();
    setMessage("");

    try {
      const endpoint =
        authMode === "login" ? "/login" : "/register";

      const data = await request(endpoint, {
        method: "POST",
        body: JSON.stringify(authData)
      });

      localStorage.setItem("taskToken", data.token);
      localStorage.setItem("taskUser", JSON.stringify(data.user));

      setToken(data.token);
      setUser(data.user);
      setMessage(data.message);
    } catch (error) {
      setMessage(error.message);
    }
  }

  function logout() {
    localStorage.removeItem("taskToken");
    localStorage.removeItem("taskUser");
    setToken("");
    setUser(null);
    setTasks([]);
    setMessage("");
  }

  function openNewTask() {
    setForm(emptyTask);
    setEditingId(null);
    setShowForm(true);
  }

  function openEditTask(task) {
    setForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      status: task.status,
      due_date: task.due_date
        ? String(task.due_date).slice(0, 10)
        : ""
    });

    setEditingId(task.id);
    setShowForm(true);
  }

  async function saveTask(e) {
    e.preventDefault();
    setMessage("");

    try {
      const endpoint = editingId
        ? `/tasks/${editingId}`
        : "/tasks";

      const data = await request(endpoint, {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(form)
      });

      if (editingId) {
        setTasks(prev =>
          prev.map(task => task.id === editingId ? data : task)
        );
      } else {
        setTasks(prev => [data, ...prev]);
      }

      setShowForm(false);
      setForm(emptyTask);
      setEditingId(null);
      setMessage(editingId ? "Task updated!" : "Task created!");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteTask(id) {
    if (!window.confirm("Are you sure you want to delete this task?")) {
      return;
    }

    try {
      await request(`/tasks/${id}`, { method: "DELETE" });
      setTasks(prev => prev.filter(task => task.id !== id));
      setMessage("Task deleted successfully!");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function changeStatus(task, status) {
    try {
      const updated = await request(`/tasks/${task.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: task.title,
          description: task.description || "",
          priority: task.priority,
          status,
          due_date: task.due_date
            ? String(task.due_date).slice(0, 10)
            : ""
        })
      });

      setTasks(prev =>
        prev.map(item => item.id === task.id ? updated : item)
      );
    } catch (error) {
      setMessage(error.message);
    }
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      const matchesSearch =
        task.title.toLowerCase().includes(search.toLowerCase()) ||
        (task.description || "").toLowerCase().includes(search.toLowerCase());

      const matchesFilter =
        filter === "All" || task.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [tasks, search, filter]);

  const completed = tasks.filter(
    task => task.status === "Completed"
  ).length;

  const pending = tasks.filter(
    task => task.status === "Pending"
  ).length;

  const inProgress = tasks.filter(
    task => task.status === "In Progress"
  ).length;

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="brand-icon"><ListTodo size={30} /></div>
          <h1>TaskFlow</h1>
          <p className="auth-subtitle">
            Organize your work. Achieve your goals.
          </p>

          <div className="auth-tabs">
            <button
              className={authMode === "login" ? "active" : ""}
              onClick={() => {
                setAuthMode("login");
                setMessage("");
              }}
            >
              Login
            </button>
            <button
              className={authMode === "register" ? "active" : ""}
              onClick={() => {
                setAuthMode("register");
                setMessage("");
              }}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleAuth}>
            {authMode === "register" && (
              <label>
                Full Name
                <input
                  required
                  placeholder="Enter your name"
                  value={authData.name}
                  onChange={e =>
                    setAuthData({
                      ...authData,
                      name: e.target.value
                    })
                  }
                />
              </label>
            )}

            <label>
              Email Address
              <input
                required
                type="email"
                placeholder="Enter your email"
                value={authData.email}
                onChange={e =>
                  setAuthData({
                    ...authData,
                    email: e.target.value
                  })
                }
              />
            </label>

            <label>
              Password
              <input
                required
                type="password"
                minLength="6"
                placeholder="Minimum 6 characters"
                value={authData.password}
                onChange={e =>
                  setAuthData({
                    ...authData,
                    password: e.target.value
                  })
                }
              />
            </label>

            {message && <p className="message">{message}</p>}

            <button className="primary-btn full-btn" type="submit">
              {authMode === "login" ? "Login to Dashboard" : "Create Account"}
            </button>
          </form>

          <p className="auth-footer">
            Secure task management with TaskFlow
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-icon small"><ListTodo /></div>
          <span>TaskFlow</span>
          <button
            className="mobile-close"
            onClick={() => setMobileMenu(false)}
          >
            <X />
          </button>
        </div>

        <p className="nav-heading">MENU</p>

        <button className="nav-link selected">
          <LayoutDashboard size={19} />
          Dashboard
        </button>

        <div className="sidebar-bottom">
          <div className="user-box">
            <div className="avatar">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <strong>{user?.name}</strong>
              <span>{user?.email}</span>
            </div>
          </div>

          <button className="logout-btn" onClick={logout}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button
            className="menu-btn"
            onClick={() => setMobileMenu(true)}
          >
            <Menu />
          </button>

          <div>
            <h2>Dashboard</h2>
            <p>Welcome back, {user?.name}!</p>
          </div>

          <button className="primary-btn add-top" onClick={openNewTask}>
            <Plus size={18} /> Add New Task
          </button>
        </header>

        {message && (
          <div className="notice">
            {message}
            <button onClick={() => setMessage("")}><X size={16} /></button>
          </div>
        )}

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon purple"><ListTodo /></div>
            <div><span>Total Tasks</span><h2>{tasks.length}</h2></div>
          </div>

          <div className="stat-card">
            <div className="stat-icon orange"><Clock3 /></div>
            <div><span>Pending</span><h2>{pending}</h2></div>
          </div>

          <div className="stat-card">
            <div className="stat-icon blue"><Flag /></div>
            <div><span>In Progress</span><h2>{inProgress}</h2></div>
          </div>

          <div className="stat-card">
            <div className="stat-icon green"><CheckCircle2 /></div>
            <div><span>Completed</span><h2>{completed}</h2></div>
          </div>
        </section>

        <section className="tasks-section">
          <div className="section-heading">
            <div>
              <h2>My Tasks</h2>
              <p>Manage and track all your tasks</p>
            </div>
            <button className="primary-btn mobile-add" onClick={openNewTask}>
              <Plus size={18} /> Add Task
            </button>
          </div>

          <div className="toolbar">
            <div className="search-box">
              <Search size={18} />
              <input
                placeholder="Search tasks..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
            >
              <option>All</option>
              <option>Pending</option>
              <option>In Progress</option>
              <option>Completed</option>
            </select>
          </div>

          {loading ? (
            <div className="empty-state">Loading tasks...</div>
          ) : filteredTasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><ListTodo size={35} /></div>
              <h3>No tasks found</h3>
              <p>Create your first task to get started.</p>
              <button className="primary-btn" onClick={openNewTask}>
                <Plus size={18} /> Create Task
              </button>
            </div>
          ) : (
            <div className="task-grid">
              {filteredTasks.map(task => (
                <article className="task-card" key={task.id}>
                  <div className="task-card-top">
                    <span className={`priority ${task.priority.toLowerCase()}`}>
                      {task.priority} Priority
                    </span>
                    <div className="task-actions">
                      <button title="Edit" onClick={() => openEditTask(task)}>
                        <Pencil size={17} />
                      </button>
                      <button
                        title="Delete"
                        className="delete-action"
                        onClick={() => deleteTask(task.id)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>

                  <h3>{task.title}</h3>
                  <p className="task-description">
                    {task.description || "No description provided."}
                  </p>

                  <div className="task-date">
                    <CalendarDays size={16} />
                    {task.due_date
                      ? new Date(String(task.due_date).slice(0, 10) + "T00:00:00")
                          .toLocaleDateString()
                      : "No due date"}
                  </div>

                  <div className="task-card-footer">
                    <span className={`status ${task.status.toLowerCase().replace(" ", "-")}`}>
                      {task.status}
                    </span>

                    <select
                      aria-label="Change task status"
                      value={task.status}
                      onChange={e => changeStatus(task, e.target.value)}
                    >
                      <option>Pending</option>
                      <option>In Progress</option>
                      <option>Completed</option>
                    </select>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="task-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <h2>{editingId ? "Update Task" : "Create New Task"}</h2>
                <p>Enter your task details below.</p>
              </div>
              <button className="close-btn" onClick={() => setShowForm(false)}>
                <X />
              </button>
            </div>

            <form onSubmit={saveTask}>
              <label>
                Task Title *
                <input
                  required
                  maxLength="200"
                  placeholder="Enter task title"
                  value={form.title}
                  onChange={e =>
                    setForm({ ...form, title: e.target.value })
                  }
                />
              </label>

              <label>
                Description
                <textarea
                  rows="4"
                  placeholder="Write task description..."
                  value={form.description}
                  onChange={e =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </label>

              <div className="form-row">
                <label>
                  Priority
                  <select
                    value={form.priority}
                    onChange={e =>
                      setForm({ ...form, priority: e.target.value })
                    }
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                  </select>
                </label>

                <label>
                  Status
                  <select
                    value={form.status}
                    onChange={e =>
                      setForm({ ...form, status: e.target.value })
                    }
                  >
                    <option>Pending</option>
                    <option>In Progress</option>
                    <option>Completed</option>
                  </select>
                </label>
              </div>

              <label>
                Due Date
                <input
                  type="date"
                  value={form.due_date}
                  onChange={e =>
                    setForm({ ...form, due_date: e.target.value })
                  }
                />
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-btn">
                  {editingId ? "Save Changes" : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}