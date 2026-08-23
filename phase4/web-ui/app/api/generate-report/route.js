import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  const days = searchParams.get('days') || '30';
  const maxReviews = searchParams.get('max_reviews') || '1000';

  const projectRoot = process.cwd().includes('web-ui') 
    ? path.join(process.cwd(), '..', '..') 
    : process.cwd();
  
  // [NEW] GitHub Action Trigger for Vercel/Production
  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO || 'danwantari/voxfin-intelligence';

  // If we are on Vercel, we MUST use GitHub Actions. Local python3 won't work.
  if (process.env.VERCEL) {
    if (!githubToken) {
      return NextResponse.json({ error: "Configuration Required", message: "Missing GITHUB_TOKEN." }, { status: 400 });
    }

    try {
      // [MODIFIED] Bypassing intelligence cache to ensure fresh reports on every manual trigger
      // Previous logic was returning old reports even if sliders were adjusted.

      // 2. CONCURRENCY GUARD: Check for existing in-progress actions
      const actionsRes = await fetch(`https://api.github.com/repos/${githubRepo}/actions/runs?status=in_progress`, {
        headers: { 'Authorization': `token ${githubToken}`, 'Accept': 'application/vnd.github.v3+json' }
      });
      const actionsData = await actionsRes.json();
      const inProgress = actionsData.workflow_runs?.filter(run => run.name.includes("Weekly Review Pulse") || run.path.includes("scheduler.yml"));

      if (inProgress && inProgress.length > 0) {
        return NextResponse.json({ 
          status: "started", 
          message: "An analysis is ALREADY running in the cloud. We will auto-redirect as soon as it's done.",
          remote: true 
        });
      }

      // 3. TRIGGER CLOUD WORKER: If no cache and no active run
      const res = await fetch(`https://api.github.com/repos/${githubRepo}/actions/workflows/scheduler.yml/dispatches`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Vercel-INDPlus'
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            max_reviews: maxReviews,
            weeks: Math.ceil(parseInt(days)/7).toString()
          }
        })
      });

      if (res.status === 204) {
        // Wait 1 second for the run to appear in the list
        await new Promise(r => setTimeout(r, 1500));
        const runsRes = await fetch(`https://api.github.com/repos/${githubRepo}/actions/runs?per_page=1`, {
          headers: { 'Authorization': `token ${githubToken}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        const runsData = await runsRes.json();
        const runId = runsData.workflow_runs?.[0]?.id;

        return NextResponse.json({ 
          status: "started", 
          run_id: runId,
          message: "Intelligence synthesis dispatched to cloud worker." 
        });
      } else {
        const errData = await res.json();
        return NextResponse.json({ error: "GitHub API Error", details: errData }, { status: res.status });
      }
    } catch (e) {
      return NextResponse.json({ error: "Failed to trigger remote worker", details: e.message }, { status: 500 });
    }
  }

  // Fallback to local execution (ONLY for local development)
  const bridgePath = path.join(projectRoot, 'phase4', 'generate_bridge.py');
  const command = `python3 "${bridgePath}" --days ${days} --max_reviews ${maxReviews}`;

  return new Promise((resolve) => {
    exec(command, { cwd: projectRoot }, (error, stdout, stderr) => {
      if (error) {
        resolve(NextResponse.json({ error: "Local execution failed. If on Vercel, use GITHUB_TOKEN.", details: error.message }, { status: 500 }));
        return;
      }
      try {
        const result = JSON.parse(stdout);
        resolve(NextResponse.json(result));
      } catch (e) {
        resolve(NextResponse.json({ error: "Parsing error", output: stdout }, { status: 500 }));
      }
    });
  });
}
