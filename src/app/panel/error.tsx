"use client";

export default function PanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "inherit",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          background: "white",
          border: "1px solid #eae6ef",
          borderRadius: 16,
          padding: "40px 32px",
        }}
      >
        <h1 style={{ fontSize: 20, letterSpacing: -0.5, marginBottom: 12 }}>
          Error al cargar el panel
        </h1>
        <p style={{ fontSize: 13, color: "#777", marginBottom: 20 }}>
          {error.message}
        </p>
        {error.digest && (
          <p style={{ fontSize: 11, color: "#aaa", marginBottom: 20 }}>
            Referencia: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          style={{
            background: "#703be6",
            color: "white",
            border: "none",
            borderRadius: 9,
            padding: "10px 18px",
            fontSize: 13,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
