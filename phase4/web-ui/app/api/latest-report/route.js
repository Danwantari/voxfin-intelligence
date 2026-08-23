import { NextResponse } from 'next/server';

export async function GET() {
  const githubRepo = process.env.GITHUB_REPO || "danwantari/voxfin-intelligence";
  const githubToken = process.env.GITHUB_TOKEN;

  try {
    const res = await fetch(`https://api.github.com/repos/${githubRepo}/contents/data/reports_archive.json`, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3.raw'
      },
      cache: 'no-store'
    });
    
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return NextResponse.json({ 
        id: data[0].id, 
        created_at: data[0].created_at 
      });
    }
    return NextResponse.json({ error: "No reports found" }, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
