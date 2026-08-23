import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const projectRoot = process.cwd().includes('web-ui')
      ? path.join(process.cwd(), '..', '..')
      : process.cwd();
    const filePath = path.join(projectRoot, 'data', 'reports_archive.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    return NextResponse.json(JSON.parse(raw));
  } catch (err) {
    return NextResponse.json([]);
  }
}
