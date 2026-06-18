import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Kareem — daily math that follows your child";

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
              fontSize: 76,
              fontWeight: 800,
            }}
          >
            K
          </div>
          <div style={{ fontSize: 96, fontWeight: 800 }}>Kareem</div>
        </div>
        <div style={{ fontSize: 42, marginTop: 30, opacity: 0.95 }}>
          Daily math that follows your child
        </div>
        <div style={{ fontSize: 28, marginTop: 18, opacity: 0.8 }}>
          Grades 1–8 · US Common Core · UK · Singapore
        </div>
      </div>
    ),
    { ...size },
  );
}
