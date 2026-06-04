import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";

export default function LandingPage() {
  const navigate = useNavigate();
  const heroRef = useRef(null);

  // Subtle parallax on mouse move
  useEffect(() => {
    function handleMouse(e) {
      const x = (e.clientX / window.innerWidth - 0.5) * 12;
      const y = (e.clientY / window.innerHeight - 0.5) * 12;
      if (heroRef.current) {
        heroRef.current.style.transform = `translate(${x}px, ${y}px)`;
      }
    }
    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, []);

  return (
    <div style={styles.root}>
      {/* Blueprint grid overlay */}
      <div style={styles.grid} />

      {/* Glow blobs */}
      <div
        style={{
          ...styles.blob,
          top: "15%",
          left: "10%",
          width: 480,
          height: 480,
          background:
            "radial-gradient(circle, rgba(255,200,80,0.06) 0%, transparent 70%)",
        }}
      />
      <div
        style={{
          ...styles.blob,
          bottom: "10%",
          right: "8%",
          width: 560,
          height: 560,
          background:
            "radial-gradient(circle, rgba(255,200,80,0.04) 0%, transparent 70%)",
        }}
      />

      <main style={styles.main}>
        {/* Logo + wordmark */}
        <div ref={heroRef} style={styles.hero}>
          <img src={logo} alt="KalkylPal logo" style={styles.logo} />
          <div style={styles.wordmark}>
            <h1 style={styles.title}>
              KALKYL<span style={styles.titleAccent}>PAL</span>
            </h1>
            <p style={styles.tagline}>Din Kalkyl Kompis</p>
          </div>
        </div>

        {/* Divider */}
        <div style={styles.divider} />

        {/* Description */}
        <p style={styles.description}>
          Skanna ritningar.
          <br />
          Hitta komponenter. Exportera resultat.
        </p>

        {/* Feature chips */}
        <div style={styles.chips}>
          {["PDF-skanning", "Projektöversikt", "Excel & PDF-export"].map(
            (f) => (
              <span key={f} style={styles.chip}>
                {f}
              </span>
            ),
          )}
        </div>

        {/* CTA */}
        <button
          style={styles.cta}
          onClick={() => navigate("/login")}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "rgba(255,200,80,0.18)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          Logga in
        </button>

        <p style={styles.footer}>
          © {new Date().getFullYear()} KalkylPal · Din Kalkyl Kompis
        </p>
      </main>
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
    position: "relative",
    overflow: "hidden",
    fontFamily: "'IBM Plex Mono', monospace",
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
  blob: {
    position: "absolute",
    borderRadius: "50%",
    pointerEvents: "none",
  },
  main: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 28,
    padding: "48px 32px",
    maxWidth: 560,
    width: "100%",
    textAlign: "center",
  },
  hero: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 24,
    transition: "transform 0.15s ease-out",
  },
  logo: {
    width: 96,
    height: 96,
    objectFit: "contain",
    filter: "drop-shadow(0 0 24px rgba(255,200,80,0.3))",
    animation: "pulse 4s ease-in-out infinite",
  },
  wordmark: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
  },
  title: {
    margin: 0,
    fontSize: 48,
    fontWeight: 700,
    letterSpacing: "0.18em",
    color: "#f0f4ff",
    lineHeight: 1,
  },
  titleAccent: {
    color: "#f5c842",
  },
  tagline: {
    margin: 0,
    fontSize: 13,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.35)",
  },
  divider: {
    width: 48,
    height: 1,
    background:
      "linear-gradient(90deg, transparent, rgba(245,200,66,0.5), transparent)",
  },
  description: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.8,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: "0.02em",
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  chip: {
    padding: "4px 12px",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 2,
    fontSize: 11,
    letterSpacing: "0.08em",
    color: "rgba(255,255,255,0.4)",
    background: "rgba(255,255,255,0.03)",
  },
  cta: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "14px 40px",
    border: "1px solid rgba(245,200,66,0.6)",
    borderRadius: 2,
    background: "transparent",
    color: "#f5c842",
    fontSize: 13,
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    fontFamily: "'IBM Plex Mono', monospace",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.2s",
  },
  ctaArrow: {
    fontSize: 16,
    transition: "transform 0.2s",
  },
  footer: {
    margin: 0,
    fontSize: 10,
    letterSpacing: "0.1em",
    color: "rgba(255,255,255,0.18)",
  },
};
