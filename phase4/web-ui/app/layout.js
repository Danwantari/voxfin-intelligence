import './globals.css'
import Link from 'next/link'

export const metadata = {
  title: 'VoxFin Intelligence | Voice-of-Customer Platform',
  description: 'AI-powered voice-of-customer intelligence for fintech product and engineering teams.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <nav className="glass-panel px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2 group mr-4">
                <div className="w-8 h-8 bg-[#0066CC] rounded-lg flex items-center justify-center text-white font-bold text-xl group-hover:scale-105 transition-transform">
                  V
                </div>
                <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-white">VoxFin</span>
              </Link>
              <div className="hidden lg:flex items-center gap-1">
                <Link href="/reviews" className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-[#0066CC] transition-colors">INDMoney Insights</Link>
                <Link href="/analytics" className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-[#0066CC] transition-colors">Categories</Link>
                <Link href="/reports" className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-[#0066CC] transition-colors flex items-center gap-1.5">
                  INDPlus
                  <span className="text-[8px] px-1 bg-[#0066CC]/10 text-[#0066CC] rounded font-bold border border-[#0066CC]/20">MCP</span>
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="px-3 py-1 bg-slate-900 text-slate-300 text-[10px] font-bold rounded border border-slate-700 uppercase tracking-[0.15em] shadow-sm flex items-center gap-1.5">
                <div className="w-1 h-1 bg-slate-400 rounded-full animate-pulse"></div>
                Production
              </div>
              <button className="h-8 px-1 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
                <span className="sr-only">Profile</span>
                <div className="h-6 px-2.5 rounded-full bg-[#0066CC]/20 text-[#0066CC] text-[10px] font-bold flex items-center justify-center whitespace-nowrap">
                  Danwantari
                </div>
              </button>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto p-6 min-h-[calc(100vh-76px)]">
          {children}
        </main>
      </body>
    </html>
  )
}
