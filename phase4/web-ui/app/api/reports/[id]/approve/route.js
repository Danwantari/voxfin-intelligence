import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST(request, { params }) {
  // 1. AWAIT PARAMS: Next.js 15+ requirement to fix 'id undefined'
  const { id } = await params;
  const body = await request.json();
  const { text, email, mode } = body;

  const projectRoot = process.cwd().includes('web-ui') 
    ? path.join(process.cwd(), '..', '..') 
    : process.cwd();

  // 2. VERCEL / PRODUCTION CHECK: Trigger GitHub Action instead of local python3
  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO || 'danwantari/voxfin-intelligence';

  if (process.env.VERCEL) {
    if (!githubToken) {
      return NextResponse.json({ error: "Missing GITHUB_TOKEN on Vercel." }, { status: 400 });
    }

    try {
      const res = await fetch(`https://api.github.com/repos/${githubRepo}/actions/workflows/approve_pulse.yml/dispatches`, {
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
            id: id.toString(),
            text: text,
            email: email,
            mode: mode || 'both'
          }
        })
      });

      if (res.status === 204) {
        return NextResponse.json({ 
          status: "started", 
          message: "Approval & Distribution dispatched to cloud worker." 
        });
      } else {
        const errData = await res.json();
        return NextResponse.json({ error: "GitHub API Error", details: errData }, { status: res.status });
      }
    } catch (e) {
      return NextResponse.json({ error: "Failed to trigger approval worker", details: e.message }, { status: 500 });
    }
  }
  
  // 3. LOCAL FALLBACK
  const bridgePath = path.join(projectRoot, 'phase4', 'approve_bridge.py');
  const escapedText = text.replace(/"/g, '\\"');
  const command = `python3 "${bridgePath}" --id ${id} --text "${escapedText}" --email "${email}" --mode ${mode || 'both'}`;

  return new Promise((resolve) => {
    exec(command, { cwd: projectRoot }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        resolve(NextResponse.json({ error: error.message, details: stderr }, { status: 500 }));
        return;
      }
      
      try {
        const result = JSON.parse(stdout);
        resolve(NextResponse.json(result));
      } catch (e) {
        resolve(NextResponse.json({ error: "Failed to parse Python output", output: stdout, stderr }, { status: 500 }));
      }
    });
  });
}
