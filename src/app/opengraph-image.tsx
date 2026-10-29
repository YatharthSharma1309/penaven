import { ImageResponse } from "next/og";
import { companyDescription, companyName, companyTagline } from "@/lib/brand";

export const alt = `${companyName} — ${companyTagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "72px 80px",
          background: "#f8fafc",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <svg width="84" height="84" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="8" fill="#312e81" />
            <path
              fill="#fff"
              fillRule="evenodd"
              d="M8.2 6.2h8.4c3.7 0 6.1 2.3 6.1 5.7s-2.4 5.7-6.1 5.7H11.6V25.8H8.2V6.2zm3.4 2.8v5.6h4.6c1.7 0 2.8-1.1 2.8-2.8s-1.1-2.8-2.8-2.8h-4.6z"
            />
            <path fill="#2dd4bf" d="M16 32h16V16L16 32z" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 64,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: "#1e293b",
                lineHeight: 1,
              }}
            >
              {companyName}
            </div>
            <div
              style={{
                marginTop: 10,
                fontSize: 24,
                fontWeight: 600,
                color: "#312e81",
              }}
            >
              {companyTagline}
            </div>
          </div>
        </div>
        <p
          style={{
            margin: "36px 0 0",
            fontSize: 28,
            lineHeight: 1.45,
            color: "#475569",
            maxWidth: 980,
          }}
        >
          {companyDescription}
        </p>
      </div>
    ),
    { ...size },
  );
}
