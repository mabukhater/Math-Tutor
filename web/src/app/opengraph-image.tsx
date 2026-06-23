import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Astute Academy — daily math that follows your child";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0e7a57",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              width: 104,
              height: 104,
              borderRadius: 26,
              background: "#1d9e75",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
            }}
          >
            <span style={{ fontSize: 76 }}>A</span>
            <span style={{ fontSize: 40, alignSelf: "flex-start", marginTop: 16 }}>+</span>
          </div>
          <div style={{ fontSize: 96, fontWeight: 800 }}>Astute Academy</div>
        </div>
        <div style={{ fontSize: 42, marginTop: 30, opacity: 0.95 }}>
          Math &amp; reading that follow your child
        </div>
        <div style={{ fontSize: 28, marginTop: 18, opacity: 0.8 }}>
          Grades 1–8 · US Common Core · UK · Singapore
        </div>
      </div>
    ),
    { ...size },
  );
}
