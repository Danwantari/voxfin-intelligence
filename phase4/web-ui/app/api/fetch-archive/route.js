import { NextResponse } from 'next/server';

export async function GET() {
  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO || "danwantari/voxfin-intelligence";

  try {
    // Fetch via GitHub API using Server-Side Token to avoid Rate Limits
    const res = await fetch(`https://api.github.com/repos/${githubRepo}/contents/data/reports_archive.json`, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3.raw'
      },
      cache: 'no-store'
    });

    if (!res.ok) {
      // If API fails, try the RAW URL as fallback
      const rawRes = await fetch(`https://raw.githubusercontent.com/${githubRepo}/main/data/reports_archive.json?t=${Date.now()}`, {
        cache: 'no-store'
      });
      if (!rawRes.ok) return NextResponse.json([]);
      const rawData = await rawRes.json();
      return NextResponse.json(rawData);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Archive fetch failed:", err);
    return NextResponse.json([]);
  }
}
