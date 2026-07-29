import { ImageResponse } from "next/og";

export const alt = "AgentRail forensic recorder for AI agents";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#070b0d",
        color: "#f4efe5",
        fontFamily: "Arial, sans-serif",
        padding: 64,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontSize: 30,
          fontWeight: 700,
        }}
      >
        <div
          style={{
            width: 36,
            height: 2,
            background: "#f0ad2c",
          }}
        />
        AgentRail
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div
          style={{
            color: "#f0ad2c",
            fontSize: 26,
            letterSpacing: 6,
            textTransform: "uppercase",
          }}
        >
          Forensic recorder for AI agents
        </div>
        <div
          style={{
            maxWidth: 900,
            fontSize: 86,
            fontWeight: 700,
            lineHeight: 0.98,
            letterSpacing: -4,
          }}
        >
          Trace decisions, evidence, and spend before they disappear.
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: "#b9b2a6",
          fontSize: 25,
        }}
      >
        <span>Local-first SDK</span>
        <span>MCP reader</span>
        <span>agentrail.id</span>
      </div>
    </div>,
    {
      ...size,
    },
  );
}
