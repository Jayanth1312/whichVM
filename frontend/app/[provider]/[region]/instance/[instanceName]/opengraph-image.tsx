import { ImageResponse } from "next/og";
import { fetchInstanceData } from "@/lib/fetch-instance";

export const alt = "WhichVM Instance Details";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ provider: string; region: string; instanceName: string }>;
}) {
  const resolvedParams = await params;
  const provider = resolvedParams.provider.toUpperCase();
  const instance = await fetchInstanceData(
    resolvedParams.provider,
    resolvedParams.region,
    decodeURIComponent(resolvedParams.instanceName),
  );

  const colors: Record<string, string> = {
    AWS: "#ec9c24",
    GCP: "#2563eb",
    AZURE: "#0078d4",
  };
  const themeColor = colors[provider] || "#2563eb";

  if (!instance) {
    return new ImageResponse(
      (
        <div style={{ background: "#0a0a0a", width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 40, fontWeight: "bold" }}>
          WhichVM - Instance Not Found
        </div>
      ),
      { ...size }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          background: "#070707",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
          border: "1px solid #222",
        }}
      >
        {/* Absolute Background Blur items */}
        <div style={{ position: "absolute", top: -100, right: -100, width: 400, height: 400, background: themeColor, opacity: 0.15, borderRadius: "100%", filter: "blur(70px)" }} />
        <div style={{ position: "absolute", bottom: -150, left: -50, width: 350, height: 350, background: "#10b981", opacity: 0.1, borderRadius: "100%", filter: "blur(60px)" }} />

        {/* Left Side: Summary and Specs */}
        <div style={{ display: "flex", flexDirection: "column", flex: 2, padding: 60, justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ background: themeColor, width: 24, height: 24, borderRadius: 6 }} />
            <span style={{ color: "#a1a1aa", fontSize: 18, fontWeight: "bold", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {provider} Instance
            </span>
          </div>

          <h1 style={{ fontSize: 64, fontWeight: 900, marginBottom: 8, letterSpacing: "-0.04em", color: "#f8fafc" }}>
            {instance.n}
          </h1>
          <p style={{ fontSize: 20, color: "#94a3b8", marginBottom: 40, maxWidth: 600 }}>
            {instance.f} family instance running on {provider} cloud infrastructure setup.
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 30, maxWidth: 650 }}>
            <div style={{ display: "flex", flexDirection: "column", background: "#111", border: "1px solid #222", padding: "16px 24px", borderRadius: 16, minWidth: 160 }}>
              <span style={{ fontSize: 12, color: "#71717a", fontWeight: "bold", textTransform: "uppercase" }}>vCPUs</span>
              <span style={{ fontSize: 28, color: "#fff", fontWeight: "bold", marginTop: 4 }}>{instance.v}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", background: "#111", border: "1px solid #222", padding: "16px 24px", borderRadius: 16, minWidth: 160 }}>
              <span style={{ fontSize: 12, color: "#71717a", fontWeight: "bold", textTransform: "uppercase" }}>Memory</span>
              <span style={{ fontSize: 28, color: "#fff", fontWeight: "bold", marginTop: 4 }}>{instance.m} GiB</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", background: "#111", border: "1px solid #222", padding: "16px 24px", borderRadius: 16, minWidth: 160 }}>
              <span style={{ fontSize: 12, color: "#71717a", fontWeight: "bold", textTransform: "uppercase" }}>Processor</span>
              <span style={{ fontSize: 28, color: "#fff", fontWeight: "bold", marginTop: 4 }}>{instance.a}</span>
            </div>
          </div>
        </div>

        {/* Right Side: Visual Accent and Brand */}
        <div
          style={{
            display: "flex",
            flex: 1,
            background: `linear-gradient(135deg, ${themeColor}10, ${themeColor}30)`,
            borderLeft: "1px solid #1a1a1a",
            position: "relative",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <path d="M12 1L22 6.5V17.5L12 23L2 17.5V6.5L12 1Z" />
              <path d="M2 6.5L12 12L22 6.5" />
            </svg>
            <span style={{ fontSize: 24, fontWeight: "bold", color: "#fff", marginTop: 12, letterSpacing: "-0.02em" }}>
              WhichVM
            </span>
            <span style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
              whichvm.com
            </span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
