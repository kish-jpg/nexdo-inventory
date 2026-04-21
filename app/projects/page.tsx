"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/app/components/Modal";

type ProjectSummary = {
  id: number;
  name: string;
  client: string;
  owner: string;
  status: string;
  priority: string;
  startDate: string | null;
  dueDate: string | null;
  progress: number;
  summary: string;
  notes: string;
  lastUpdated: string;
  taskCount: number;
  completedTasks: number;
  overdueTasks: number;
  openTasks: number;
};

type TaskRecord = {
  id: number;
  projectId: number;
  projectName: string;
  title: string;
  owner: string;
  status: string;
  priority: string;
  dueDate: string | null;
  notes: string;
  completedAt: string | null;
  lastUpdated: string;
};

type DashboardPayload = {
  kpis: {
    totalProjects: number;
    activeProjects: number;
    totalTasks: number;
    inFlightTasks: number;
    overdueTasks: number;
    avgProgress: number;
    doneTasks: number;
  };
  projects: ProjectSummary[];
  recentTasks: TaskRecord[];
};

type ProjectFormProps = {
  mode: "new" | "edit";
  project?: ProjectSummary | null;
  onClose: () => void;
  onSaved: () => void;
};

type TaskFormProps = {
  projects: ProjectSummary[];
  selectedProjectId: number | null;
  task?: TaskRecord | null;
  onClose: () => void;
  onSaved: () => void;
};

const PROJECT_STATUSES = ["Planning", "In Progress", "Blocked", "Review", "Done"];
const TASK_STATUSES = ["Todo", "In Progress", "Blocked", "Done"];
const PRIORITIES = ["Low", "Medium", "High", "Critical"];

function fmtDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function isOverdue(date: string | null, status: string) {
  if (!date || status === "Done") return false;
  return date < new Date().toISOString().slice(0, 10);
}

function statusTone(status: string) {
  if (status === "Done") return "var(--green)";
  if (status === "Blocked") return "var(--red)";
  if (status === "Review") return "var(--blue)";
  return "var(--amber)";
}

function priorityTone(priority: string) {
  if (priority === "Critical") return "var(--red)";
  if (priority === "High") return "var(--amber)";
  if (priority === "Low") return "var(--green)";
  return "var(--blue)";
}

function badgeStyle(color: string) {
  return {
    background: `${color}20`,
    color,
    border: `1px solid ${color}35`,
    padding: "3px 8px",
    borderRadius: 5,
    fontFamily: "JetBrains Mono, monospace",
    fontSize: 10,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };
}

function ProjectFormModal({ mode, project, onClose, onSaved }: ProjectFormProps) {
  const [form, setForm] = useState({
    name: project?.name ?? "",
    client: project?.client ?? "",
    owner: project?.owner ?? "",
    status: project?.status ?? "Planning",
    priority: project?.priority ?? "Medium",
    startDate: project?.startDate ?? "",
    dueDate: project?.dueDate ?? "",
    progress: String(project?.progress ?? 0),
    summary: project?.summary ?? "",
    notes: project?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (key: keyof typeof form, value: string) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Project name is required.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      const res = await fetch(mode === "new" ? "/api/projects" : `/api/projects/${project!.id}`, {
        method: mode === "new" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          progress: Number(form.progress) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save project");
      onSaved();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="project-form-title" maxWidth={640}>
      <div className="modal-header">
        <div>
          <div className="modal-title" id="project-form-title">
            {mode === "new" ? "Create Project" : `Edit Project: ${project?.name}`}
          </div>
          <div className="meta-label" style={{ marginTop: 4, textTransform: "none" }}>
            Track owners, deadlines, and progress in one place.
          </div>
        </div>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      {error && <div className="error-box">{error}</div>}

      <form onSubmit={submit}>
        <div className="form-two-col">
          <div className="form-row">
            <label className="form-label">Project Name *</label>
            <input className="form-input" value={form.name} onChange={e => setField("name", e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Client / Site</label>
            <input className="form-input" value={form.client} onChange={e => setField("client", e.target.value)} />
          </div>
        </div>

        <div className="form-two-col">
          <div className="form-row">
            <label className="form-label">Owner</label>
            <input className="form-input" value={form.owner} onChange={e => setField("owner", e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Progress %</label>
            <input className="form-input" type="number" min="0" max="100" value={form.progress} onChange={e => setField("progress", e.target.value)} />
          </div>
        </div>

        <div className="form-two-col">
          <div className="form-row">
            <label className="form-label">Status</label>
            <select className="form-input" value={form.status} onChange={e => setField("status", e.target.value)}>
              {PROJECT_STATUSES.map(value => <option key={value}>{value}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Priority</label>
            <select className="form-input" value={form.priority} onChange={e => setField("priority", e.target.value)}>
              {PRIORITIES.map(value => <option key={value}>{value}</option>)}
            </select>
          </div>
        </div>

        <div className="form-two-col">
          <div className="form-row">
            <label className="form-label">Start Date</label>
            <input className="form-input" type="date" value={form.startDate} onChange={e => setField("startDate", e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Due Date</label>
            <input className="form-input" type="date" value={form.dueDate} onChange={e => setField("dueDate", e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">Summary</label>
          <input className="form-input" value={form.summary} onChange={e => setField("summary", e.target.value)} />
        </div>

        <div className="form-row">
          <label className="form-label">Notes</label>
          <textarea className="form-input" rows={4} value={form.notes} onChange={e => setField("notes", e.target.value)} />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : mode === "new" ? "Create Project" : "Save Project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function TaskFormModal({ projects, selectedProjectId, task, onClose, onSaved }: TaskFormProps) {
  const hasProjects = projects.length > 0;
  const [form, setForm] = useState({
    projectId: String(task?.projectId ?? selectedProjectId ?? projects[0]?.id ?? ""),
    title: task?.title ?? "",
    owner: task?.owner ?? "",
    status: task?.status ?? "Todo",
    priority: task?.priority ?? "Medium",
    dueDate: task?.dueDate ?? "",
    notes: task?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (key: keyof typeof form, value: string) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.projectId || !form.title.trim()) {
      setError("Project and task title are required.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      const res = await fetch(task ? `/api/projects/tasks/${task.id}` : "/api/projects/tasks", {
        method: task ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          projectId: Number(form.projectId),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save task");
      onSaved();
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} labelledBy="task-form-title" maxWidth={560}>
      <div className="modal-header">
        <div>
          <div className="modal-title" id="task-form-title">
            {task ? `Edit Task: ${task.title}` : "Add Task"}
          </div>
          <div className="meta-label" style={{ marginTop: 4, textTransform: "none" }}>
            Keep tasks small, clear, and assignable.
          </div>
        </div>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      {!hasProjects && (
        <div className="error-box">Create a project first before adding tasks.</div>
      )}
      {error && <div className="error-box">{error}</div>}

      <form onSubmit={submit}>
        <div className="form-row">
          <label className="form-label">Project *</label>
          <select className="form-input" value={form.projectId} onChange={e => setField("projectId", e.target.value)} disabled={!hasProjects}>
            {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </div>

        <div className="form-row">
          <label className="form-label">Task Title *</label>
          <input className="form-input" value={form.title} onChange={e => setField("title", e.target.value)} />
        </div>

        <div className="form-two-col">
          <div className="form-row">
            <label className="form-label">Owner</label>
            <input className="form-input" value={form.owner} onChange={e => setField("owner", e.target.value)} />
          </div>
          <div className="form-row">
            <label className="form-label">Due Date</label>
            <input className="form-input" type="date" value={form.dueDate} onChange={e => setField("dueDate", e.target.value)} />
          </div>
        </div>

        <div className="form-two-col">
          <div className="form-row">
            <label className="form-label">Status</label>
            <select className="form-input" value={form.status} onChange={e => setField("status", e.target.value)}>
              {TASK_STATUSES.map(value => <option key={value}>{value}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label className="form-label">Priority</label>
            <select className="form-input" value={form.priority} onChange={e => setField("priority", e.target.value)}>
              {PRIORITIES.map(value => <option key={value}>{value}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <label className="form-label">Notes</label>
          <textarea className="form-input" rows={4} value={form.notes} onChange={e => setField("notes", e.target.value)} />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving || !hasProjects}>
            {saving ? "Saving…" : task ? "Save Task" : "Create Task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function ProjectsPage() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [taskStatusFilter, setTaskStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [projectModal, setProjectModal] = useState<"new" | "edit" | null>(null);
  const [taskModal, setTaskModal] = useState<"new" | "edit" | null>(null);
  const [editingProject, setEditingProject] = useState<ProjectSummary | null>(null);
  const [editingTask, setEditingTask] = useState<TaskRecord | null>(null);

  async function loadDashboard() {
    const res = await fetch("/api/projects/dashboard");
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to load projects");
    setDashboard(json);
    if (selectedProjectId == null && json.projects.length > 0) {
      setSelectedProjectId(json.projects[0].id);
    }
  }

  async function loadTasks(projectId?: number | null) {
    const params = new URLSearchParams();
    if (projectId) params.set("projectId", String(projectId));
    const res = await fetch(`/api/projects/tasks?${params.toString()}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Failed to load tasks");
    setTasks(json.tasks ?? []);
  }

  async function refresh(projectId = selectedProjectId) {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadDashboard(), loadTasks(projectId)]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh(null);
  }, []);

  useEffect(() => {
    if (selectedProjectId != null) {
      loadTasks(selectedProjectId).catch((err: any) => setError(err.message));
    }
  }, [selectedProjectId]);

  const selectedProject = dashboard?.projects.find(project => project.id === selectedProjectId) ?? null;

  const filteredTasks = useMemo(() => {
    if (taskStatusFilter === "All") return tasks;
    return tasks.filter(task => task.status === taskStatusFilter);
  }, [tasks, taskStatusFilter]);

  async function updateTaskStatus(task: TaskRecord, status: string) {
    const res = await fetch(`/api/projects/tasks/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || "Failed to update task");
      return;
    }
    await refresh(selectedProjectId);
  }

  function closeProjectModal() {
    setProjectModal(null);
    setEditingProject(null);
  }

  function closeTaskModal() {
    setTaskModal(null);
    setEditingTask(null);
  }

  return (
    <div className="page-wrap">
      {projectModal && (
        <ProjectFormModal
          mode={projectModal}
          project={editingProject}
          onClose={closeProjectModal}
          onSaved={() => {
            closeProjectModal();
            refresh(selectedProjectId);
          }}
        />
      )}

      {taskModal && dashboard && (
        <TaskFormModal
          projects={dashboard.projects}
          selectedProjectId={selectedProjectId}
          task={editingTask}
          onClose={closeTaskModal}
          onSaved={() => {
            closeTaskModal();
            refresh(selectedProjectId);
          }}
        />
      )}

      <div className="page-header">
        <div>
          <div className="header-row">
            <span className="brand-chip">Projects</span>
            <span className="meta-label">Command Center</span>
          </div>
          <div className="page-title">PROJECT MANAGEMENT</div>
          <div className="page-sub">Track projects, owners, deadlines, blockers, and delivery progress</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => refresh(selectedProjectId)}>Refresh</button>
          <button className="btn btn-primary" onClick={() => setProjectModal("new")}>+ New Project</button>
          <button className="btn btn-primary" onClick={() => setTaskModal("new")} disabled={!dashboard?.projects.length}>+ New Task</button>
        </div>
      </div>

      {error && <div className="error-box" style={{ marginBottom: 20 }}>{error}</div>}

      {loading && !dashboard ? (
        <div className="kpi-grid" aria-hidden>
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="kpi-card">
              <span className="skel-line" style={{ width: "45%" }} />
              <span className="skel-line skel-kpi-value" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="kpi-grid stagger-in">
            <div className="kpi-card kpi-blue">
              <div className="kpi-label">Total Projects</div>
              <div className="kpi-value">{dashboard?.kpis.totalProjects ?? 0}</div>
            </div>
            <div className="kpi-card kpi-green">
              <div className="kpi-label">Active Projects</div>
              <div className="kpi-value">{dashboard?.kpis.activeProjects ?? 0}</div>
            </div>
            <div className="kpi-card kpi-amber">
              <div className="kpi-label">Tasks In Flight</div>
              <div className="kpi-value">{dashboard?.kpis.inFlightTasks ?? 0}</div>
            </div>
            <div className="kpi-card kpi-red">
              <div className="kpi-label">Overdue Tasks</div>
              <div className="kpi-value">{dashboard?.kpis.overdueTasks ?? 0}</div>
            </div>
          </div>

          <div className="dashboard-row-4060" style={{ alignItems: "start" }}>
            <div className="glass-card">
              <div className="card-header">
                <span className="card-title">Projects</span>
                <span className="meta-label">{dashboard?.kpis.avgProgress ?? 0}% avg progress</span>
              </div>
              <div className="card-body" style={{ display: "grid", gap: 12 }}>
                {(dashboard?.projects ?? []).length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-state-title">No projects yet</div>
                    <div className="empty-state-sub">Create your first project to start building the command center.</div>
                  </div>
                ) : (
                  dashboard?.projects.map(project => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => setSelectedProjectId(project.id)}
                      className="glass-card"
                      style={{
                        padding: 16,
                        textAlign: "left",
                        borderColor: selectedProjectId === project.id ? "var(--red)" : "var(--card-border)",
                        background: selectedProjectId === project.id ? "var(--red-soft)" : "var(--surface)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{project.name}</div>
                          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
                            {project.client || "Internal"} · {project.owner || "Unassigned"}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          <span style={badgeStyle(statusTone(project.status))}>{project.status}</span>
                          <span style={badgeStyle(priorityTone(project.priority))}>{project.priority}</span>
                        </div>
                      </div>

                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                        {project.summary || "No summary yet."}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
                        <div>
                          <div className="meta-label">Tasks</div>
                          <div style={{ fontWeight: 700 }}>{project.taskCount}</div>
                        </div>
                        <div>
                          <div className="meta-label">Done</div>
                          <div style={{ fontWeight: 700, color: "var(--green)" }}>{project.completedTasks}</div>
                        </div>
                        <div>
                          <div className="meta-label">Open</div>
                          <div style={{ fontWeight: 700 }}>{project.openTasks}</div>
                        </div>
                        <div>
                          <div className="meta-label">Overdue</div>
                          <div style={{ fontWeight: 700, color: project.overdueTasks ? "var(--red)" : "var(--text)" }}>{project.overdueTasks}</div>
                        </div>
                      </div>

                      <div style={{ marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                          <span>Progress</span>
                          <span>{project.progress}%</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 999, background: "var(--hover-bg)", overflow: "hidden" }}>
                          <div style={{ width: `${project.progress}%`, height: "100%", background: "var(--red)" }} />
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "var(--text-muted)" }}>
                        <span>Due {fmtDate(project.dueDate)}</span>
                        <span
                          onClick={e => {
                            e.stopPropagation();
                            setEditingProject(project);
                            setProjectModal("edit");
                          }}
                          style={{ color: "var(--text)", fontWeight: 600 }}
                        >
                          Edit
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="glass-card">
              <div className="card-header">
                <span className="card-title">{selectedProject ? "Selected Project" : "Recent Activity"}</span>
              </div>
              <div className="card-body">
                {selectedProject ? (
                  <div style={{ display: "grid", gap: 16 }}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 18 }}>{selectedProject.name}</div>
                        <span style={badgeStyle(statusTone(selectedProject.status))}>{selectedProject.status}</span>
                      </div>
                      <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{selectedProject.summary || "No summary yet."}</div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div className="glass-card" style={{ padding: 14 }}>
                        <div className="meta-label">Owner</div>
                        <div style={{ fontWeight: 600, marginTop: 6 }}>{selectedProject.owner || "Unassigned"}</div>
                      </div>
                      <div className="glass-card" style={{ padding: 14 }}>
                        <div className="meta-label">Due Date</div>
                        <div style={{ fontWeight: 600, marginTop: 6 }}>{fmtDate(selectedProject.dueDate)}</div>
                      </div>
                    </div>

                    <div className="glass-card" style={{ padding: 14 }}>
                      <div className="meta-label">Notes</div>
                      <div style={{ marginTop: 8, fontSize: 13, color: "var(--text-muted)", whiteSpace: "pre-wrap" }}>
                        {selectedProject.notes || "No project notes yet."}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-ghost" onClick={() => {
                        setEditingProject(selectedProject);
                        setProjectModal("edit");
                      }}>
                        Edit Project
                      </button>
                      <button className="btn btn-primary" onClick={() => setTaskModal("new")}>
                        Add Task
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {(dashboard?.recentTasks ?? []).map(task => (
                      <div key={task.id} className="glass-card" style={{ padding: 14 }}>
                        <div style={{ fontWeight: 600 }}>{task.title}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4 }}>
                          {task.projectName} · {task.owner || "Unassigned"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ marginTop: 18 }}>
            <div className="card-header">
              <span className="card-title">
                {selectedProject ? `Tasks · ${selectedProject.name}` : "Tasks"}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                {["All", ...TASK_STATUSES].map(status => (
                  <button
                    key={status}
                    className={`cat-btn${taskStatusFilter === status ? " active" : ""}`}
                    onClick={() => setTaskStatusFilter(status)}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {filteredTasks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">No tasks yet</div>
                <div className="empty-state-sub">Add tasks to turn project plans into trackable work.</div>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 20 }}>Task</th>
                    {!selectedProject && <th>Project</th>}
                    <th>Owner</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Due</th>
                    <th className="text-right" style={{ paddingRight: 20 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map(task => (
                    <tr key={task.id} className={isOverdue(task.dueDate, task.status) ? "row-critical" : ""}>
                      <td style={{ paddingLeft: 20 }}>
                        <div style={{ fontWeight: 600 }}>{task.title}</div>
                        {task.notes && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{task.notes}</div>}
                      </td>
                      {!selectedProject && <td>{task.projectName}</td>}
                      <td>{task.owner || "—"}</td>
                      <td><span style={badgeStyle(statusTone(task.status))}>{task.status}</span></td>
                      <td><span style={badgeStyle(priorityTone(task.priority))}>{task.priority}</span></td>
                      <td style={{ color: isOverdue(task.dueDate, task.status) ? "var(--red)" : "var(--text-muted)" }}>
                        {fmtDate(task.dueDate)}
                      </td>
                      <td style={{ paddingRight: 20 }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          {task.status !== "Done" && (
                            <button className="btn btn-sm btn-action-blue" onClick={() => updateTaskStatus(task, "Done")}>
                              Mark Done
                            </button>
                          )}
                          {task.status === "Todo" && (
                            <button className="btn btn-sm btn-action-grey" onClick={() => updateTaskStatus(task, "In Progress")}>
                              Start
                            </button>
                          )}
                          <button
                            className="btn btn-sm btn-action-grey"
                            onClick={() => {
                              setEditingTask(task);
                              setTaskModal("edit");
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
