import { ImageResponse } from "next/og";
import { fetchInstanceData } from "@/lib/fetch-instance";

export const alt = "WhichVM Instance Details";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function getProviderIcon(provider: string) {
  if (provider === "GCP") {
    return (
      <svg width="32" height="32" viewBox="0 -25 256 256" preserveAspectRatio="xMidYMid">
        <path fill="#EA4335" d="m170.252 56.819 22.253-22.253 1.483-9.37C153.437-11.677 88.976-7.496 52.42 33.92 42.267 45.423 34.734 59.764 30.717 74.573l7.97-1.123 44.505-7.34 3.436-3.513c19.797-21.742 53.27-24.667 76.128-6.168l7.496.39Z" />
        <path fill="#4285F4" d="M224.205 73.918a100.249 100.249 0 0 0-30.217-48.722l-31.232 31.232a55.515 55.515 0 0 1 20.379 44.037v5.544c15.35 0 27.797 12.445 27.797 27.796 0 15.352-12.446 27.485-27.797 27.485h-55.671l-5.466 5.934v33.34l5.466 5.231h55.67c39.93.311 72.553-31.494 72.864-71.424a72.303 72.303 0 0 0-31.793-60.453" />
        <path fill="#34A853" d="M71.87 205.796h55.593V161.29H71.87a27.275 27.275 0 0 1-11.399-2.498l-7.887 2.42-22.409 22.253-1.952 7.574c12.567 9.489 27.9 14.825 43.647 14.757" />
        <path fill="#FBBC05" d="M71.87 61.425C31.94 61.664-.237 94.228.001 134.159a72.301 72.301 0 0 0 28.222 56.88l32.248-32.246c-13.99-6.322-20.208-22.786-13.887-36.776 6.32-13.99 22.786-20.208 36.775-13.888a27.796 27.796 0 0 1 13.887 13.888l32.248-32.248A72.224 72.224 0 0 0 71.87 61.425" />
      </svg>
    );
  }
  if (provider === "AWS") {
    return (
      <svg width="45" height="45" viewBox="0 0 304 182" preserveAspectRatio="xMidYMid">
        <path fill="#ffffff" d="m86 66 2 9c0 3 1 5 3 8v2l-1 3-7 4-2 1-3-1-4-5-3-6c-8 9-18 14-29 14-9 0-16-3-20-8-5-4-8-11-8-19s3-15 9-20c6-6 14-8 25-8a79 79 0 0 1 22 3v-7c0-8-2-13-5-16-3-4-8-5-16-5l-11 1a80 80 0 0 0-14 5h-2c-1 0-2-1-2-3v-5l1-3c0-1 1-2 3-2l12-5 16-2c12 0 20 3 26 8 5 6 8 14 8 25v32zM46 82l10-2c4-1 7-4 10-7l3-6 1-9v-4a84 84 0 0 0-19-2c-6 0-11 1-15 4-3 2-4 6-4 11s1 8 3 11c3 2 6 4 11 4zm80 10-4-1-2-3-23-78-1-4 2-2h10l4 1 2 4 17 66 15-66 2-4 4-1h8l4 1 2 4 16 67 17-67 2-4 4-1h9c2 0 3 1 3 2v2l-1 2-24 78-2 4-4 1h-9l-4-1-1-4-16-65-15 64-2 4-4 1h-9zm129 3a66 66 0 0 1-27-6l-3-3-1-2v-5c0-2 1-3 2-3h2l3 1a54 54 0 0 0 23 5c6 0 11-2 14-4 4-2 5-5 5-9l-2-7-10-5-15-5c-7-2-13-6-16-10a24 24 0 0 1 5-34l10-5a44 44 0 0 1 20-2 110 110 0 0 1 12 3l4 2 3 2 1 4v4c0 3-1 4-2 4l-4-2c-6-2-12-3-19-3-6 0-11 0-14 2s-4 5-4 9c0 3 1 5 3 7s5 4 11 6l14 4c7 3 12 6 15 10s5 9 5 14l-3 12-7 8c-3 3-7 5-11 6l-14 2z" />
        <path fill="#f90" d="M274 144A220 220 0 0 1 4 124c-4-3-1-6 2-4a300 300 0 0 0 263 16c5-2 10 4 5 8z" />
        <path fill="#f90" d="M287 128c-4-5-28-3-38-1-4 0-4-3-1-5 19-13 50-9 53-5 4 5-1 36-18 51-3 2-6 1-5-2 5-10 13-33 9-38z" />
      </svg>
    );
  }
  // Simplified Azure Style support
  return (
    <svg width="32" height="32" viewBox="0 0 96 96" preserveAspectRatio="xMidYMid">
      <path fill="#0078d4" d="M33.34 6.54h26.04l-27.03 80.1a4.15 4.15 0 0 1-3.94 2.81H8.15a4.14 4.14 0 0 1-3.93-5.47L29.4 9.38a4.15 4.15 0 0 1 3.94-2.83z" />
      <path fill="#0078d4" d="M71.17 60.26H29.88a1.91 1.91 0 0 0-1.3 3.31l26.53 24.76a4.17 4.17 0 0 0 2.85 1.13h23.38z" />
    </svg>
  );
}

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

  let minPrice = 0;
  if (instance && instance.pr) {
    const vals = Object.values(instance.pr).filter((v: any) => typeof v === "number" && v > 0) as number[];
    if (vals.length > 0) minPrice = Math.min(...vals);
  }
  const priceStr = minPrice > 0 ? `$${minPrice.toFixed(minPrice > 1 ? 2 : 4)}/hr` : "N/A";

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
        <div style={{ position: "absolute", top: -100, right: -100, width: 400, height: 400, background: themeColor, opacity: 0.15, borderRadius: "100%", filter: "blur(70px)" }} />
        <div style={{ position: "absolute", bottom: -150, left: -50, width: 350, height: 350, background: "#10b981", opacity: 0.1, borderRadius: "100%", filter: "blur(60px)" }} />

        {/* Left Side: Summary and Specs */}
        <div style={{ display: "flex", flexDirection: "column", flex: 2, padding: 60, justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            {getProviderIcon(provider)}
            <span style={{ color: "#a1a1aa", fontSize: 18, fontWeight: "bold", letterSpacing: "0.1em", textTransform: "uppercase", marginLeft: 4 }}>
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
            <div style={{ display: "flex", flexDirection: "column", background: "#111", border: "1px solid #10b98140", padding: "16px 24px", borderRadius: 16, minWidth: 160 }}>
              <span style={{ fontSize: 12, color: "#10b981", fontWeight: "bold", textTransform: "uppercase" }}>Starting Price</span>
              <span style={{ fontSize: 28, color: "#10b981", fontWeight: "bold", marginTop: 4 }}>{priceStr}</span>
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
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="miter">
              <path d="M12 1L22 6.5V17.5L12 23L2 17.5V6.5L12 1Z" />
              <path d="M2 6.5L12 12L22 6.5" />
              <path d="M12 23V12" />
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
