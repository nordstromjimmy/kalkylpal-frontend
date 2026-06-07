import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { login } from "../api";

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
      navigate("/app");
    } catch (err) {
      setError(err.message || "Fel användarnamn eller lösenord");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.root}>
      <div style={styles.grid} />

      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <img src={logo} alt="KalkylPal" style={styles.logo} />
          <h1 style={styles.title}>
            KALKYL<span style={styles.accent}>PAL</span>
          </h1>
          <p style={styles.subtitle}>Logga in för att fortsätta</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>ANVÄNDARNAMN</label>
            <input
              style={styles.input}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>LÖSENORD</label>
            <input
              style={styles.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button
            type="submit"
            disabled={loading || !username || !password}
            style={{
              ...styles.btn,
              opacity: loading || !username || !password ? 0.5 : 1,
              cursor:
                loading || !username || !password ? "not-allowed" : "pointer",
            }}
            onMouseEnter={(e) => {
              if (!loading)
                e.currentTarget.style.background = "rgba(245,200,66,0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            {loading ? "Loggar in…" : "Logga in →"}
          </button>
        </form>

        <button
          style={styles.back}
          onClick={() => navigate("/")}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "rgba(255,255,255,0.5)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "rgba(255,255,255,0.2)")
          }
        >
          ← Tillbaka
        </button>
      </div>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    background: "#080c14",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'IBM Plex Mono', monospace",
    position: "relative",
    overflow: "hidden",
  },
  grid: {
    position: "absolute",
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)
    `,
    backgroundSize: "48px 48px",
    pointerEvents: "none",
  },
  card: {
    position: "relative",
    zIndex: 1,
    width: "100%",
    maxWidth: 380,
    padding: "40px 36px",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 4,
    background: "rgba(255,255,255,0.02)",
    backdropFilter: "blur(8px)",
    display: "flex",
    flexDirection: "column",
    gap: 28,
  },
  header: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 48,
    height: 48,
    objectFit: "contain",
    filter: "drop-shadow(0 0 12px rgba(255,200,80,0.25))",
  },
  title: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: "0.18em",
    color: "#f0f4ff",
  },
  accent: { color: "#f5c842" },
  subtitle: {
    margin: 0,
    fontSize: 11,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.3)",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 10,
    letterSpacing: "0.14em",
    color: "rgba(255,255,255,0.35)",
  },
  input: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 2,
    padding: "10px 12px",
    color: "#f0f4ff",
    fontSize: 13,
    fontFamily: "'IBM Plex Mono', monospace",
    outline: "none",
    transition: "border-color 0.15s",
  },
  error: {
    margin: 0,
    fontSize: 11,
    color: "#ff5f5f",
    letterSpacing: "0.06em",
  },
  btn: {
    padding: "12px",
    border: "1px solid rgba(245,200,66,0.5)",
    borderRadius: 2,
    background: "transparent",
    color: "#f5c842",
    fontSize: 12,
    letterSpacing: "0.16em",
    fontFamily: "'IBM Plex Mono', monospace",
    fontWeight: 600,
    transition: "background 0.2s",
  },
  back: {
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.2)",
    fontSize: 11,
    fontFamily: "'IBM Plex Mono', monospace",
    cursor: "pointer",
    letterSpacing: "0.08em",
    alignSelf: "center",
    transition: "color 0.15s",
    padding: 0,
  },
};
