import { NextResponse } from "next/server";
import sitemap from "@/app/sitemap";

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");

  // Auth: Only allow the request if the secret matches our IndexNow key
  if (secret !== process.env.INDEXNOW_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Get all URLs from our sitemap
    const sitemapEntries = sitemap();
    const urls = sitemapEntries.map((entry) => entry.url);

    // 2. Prepare the IndexNow request
    const indexNowPayload = {
      host: "whichvm.com",
      key: process.env.INDEXNOW_KEY,
      keyLocation: `https://whichvm.com/${process.env.INDEXNOW_KEY}.txt`,
      urlList: urls,
    };

    // 3. Submit to IndexNow (Bing)
    const response = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(indexNowPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: "IndexNow submission failed", details: errorText }, { status: response.status });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully submitted ${urls.length} URLs to IndexNow.`,
      urlsSubmitted: urls.length 
    });

  } catch (error) {
    console.error("IndexNow Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
