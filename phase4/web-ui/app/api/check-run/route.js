import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const runId = searchParams.get('run_id');
  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO || "danwantari/voxfin-intelligence";

  if (!runId || !githubToken) {
    return NextResponse.json({ status: 'unknown' });
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${githubRepo}/actions/runs/${runId}`, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      },
      cache: 'no-store'
    });
    
    const data = await res.json();
    // Map GitHub status to our simple statuses
    let status = 'in_progress';
    if (data.status === 'completed') status = 'completed';
    else if (data.status === 'queued') status = 'queued';

    return NextResponse.json({ status });
  } catch (err) {
    return NextResponse.json({ status: 'in_progress' });
  }
}
