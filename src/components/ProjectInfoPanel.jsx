/**
 * ProjectInfoPanel.jsx — Project info shown in the center area when no
 * drawing is selected. Displays all project metadata with a Redigera/Spara
 * toggle for inline editing.
 */
import { useState, useEffect } from "react";
import ChatPanel from "./ChatPanel";

const FIELDS = [
  { key: "name", label: "Projektnamn", required: true },
  { key: "project_number", label: "Projektnummer" },
  { key: "client", label: "Kund/Beställare" },
  { key: "location", label: "Plats/Adress" },
  { key: "tender_deadline", label: "Anbudsdatum", type: "date" },
  { key: "contact_person", label: "Kontaktperson" },
  { key: "description", label: "Beskrivning", multiline: true },
  { key: "notes", label: "Anteckningar", multiline: true },
];

export default function ProjectInfoPanel({ project, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  // Sync form when project changes
  useEffect(() => {
    if (project) {
      setForm(
        Object.fromEntries(FIELDS.map((f) => [f.key, project[f.key] || ""])),
      );
    }
    setEditing(false);
  }, [project?.id]);

  function handleEdit() {
    setEditing(true);
  }

  async function handleSave() {
    if (!form.name?.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setForm(
      Object.fromEntries(FIELDS.map((f) => [f.key, project[f.key] || ""])),
    );
    setEditing(false);
  }

  if (!project) return null;

  const createdAt = project.created_at
    ? new Date(project.created_at).toLocaleDateString("sv-SE")
    : null;

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.headerLabel}>PROJEKTINFORMATION</div>
            <div style={styles.headerName}>{project.name}</div>
            {createdAt && (
              <div style={styles.headerMeta}>Skapat {createdAt}</div>
            )}
          </div>
          <div style={styles.headerActions}>
            {!editing ? (
              <button
                className="btn btn-ghost"
                style={styles.btn}
                onClick={handleEdit}
              >
                Redigera
              </button>
            ) : (
              <>
                <button
                  className="btn btn-ghost"
                  style={styles.btn}
                  onClick={handleCancel}
                >
                  Avbryt
                </button>
                <button
                  className="btn btn-primary"
                  style={styles.btn}
                  onClick={handleSave}
                  disabled={saving || !form.name?.trim()}
                >
                  {saving ? "Sparar…" : "Spara"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Fields grid */}
        <div style={styles.grid}>
          {FIELDS.map((f) => {
            const value = editing ? form[f.key] || "" : project[f.key] || "";
            const isEmpty = !value;

            return (
              <div
                key={f.key}
                style={{
                  ...styles.field,
                  gridColumn: f.multiline ? "1 / -1" : undefined,
                }}
              >
                <label style={styles.fieldLabel}>
                  {f.label}
                  {f.required && editing && (
                    <span style={{ color: "var(--red)" }}> *</span>
                  )}
                </label>

                {editing ? (
                  f.multiline ? (
                    <textarea
                      style={{
                        ...styles.input,
                        minHeight: 80,
                        resize: "vertical",
                      }}
                      value={form[f.key] || ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          [f.key]: e.target.value,
                        }))
                      }
                      placeholder={`Ange ${f.label.toLowerCase()}…`}
                    />
                  ) : (
                    <input
                      style={styles.input}
                      type={f.type || "text"}
                      value={form[f.key] || ""}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          [f.key]: e.target.value,
                        }))
                      }
                      placeholder={`Ange ${f.label.toLowerCase()}…`}
                    />
                  )
                ) : (
                  <div
                    style={{
                      ...styles.fieldValue,
                      color: isEmpty
                        ? "var(--text-dim)"
                        : "var(--text-primary)",
                    }}
                  >
                    {isEmpty ? "—" : value}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ChatPanel projectId={project.id} projectName={project.name} />
    </div>
  );
}

const styles = {
  root: {
    height: "100%",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 24,
    padding: "40px 32px",
    overflowY: "auto",
    background: "var(--bg-0)",
    boxSizing: "border-box",
  },
  card: {
    width: "100%",
    maxWidth: 1024,
    flexShrink: 0,
    maxHeight: 420,
    overflowY: "auto",
    background: "var(--bg-1)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "24px 28px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-2)",
  },
  headerLabel: {
    fontSize: 10,
    fontFamily: "var(--font-mono)",
    fontWeight: 600,
    letterSpacing: "0.14em",
    color: "var(--text-dim)",
    marginBottom: 6,
  },
  headerName: {
    fontSize: 22,
    fontFamily: "var(--font-mono)",
    fontWeight: 700,
    color: "var(--ui-white)",
    letterSpacing: "0.04em",
  },
  headerMeta: {
    fontSize: 11,
    fontFamily: "var(--font-mono)",
    color: "var(--text-dim)",
    marginTop: 4,
  },
  headerActions: {
    display: "flex",
    gap: 8,
    flexShrink: 0,
    marginLeft: 16,
  },
  btn: {
    fontSize: 11,
    padding: "5px 14px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "20px 28px",
    padding: "28px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  fieldLabel: {
    fontSize: 10,
    fontFamily: "var(--font-mono)",
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "var(--text-dim)",
  },
  fieldValue: {
    fontSize: 13,
    fontFamily: "var(--font-sans, var(--font-mono))",
    lineHeight: 1.5,
    minHeight: 20,
    paddingBottom: 6,
    borderBottom: "1px solid var(--border)",
  },
  input: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "8px 10px",
    color: "var(--text-primary)",
    fontSize: 13,
    fontFamily: "var(--font-mono)",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
};
