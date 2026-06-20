import { ImageResponse } from "next/og";

// iOS home-screen icon — must be a PNG. Full-bleed green with a white "K";
// iOS applies its own rounded-corner mask.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1d9e75",
          color: "#ffffff",
          fontSize: 120,
          fontWeight: 800,
          fontFamily: "sans-serif",
        }}
      >
        K
      </div>
    ),
    { ...size },
  );
}
