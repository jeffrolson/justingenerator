import { useState } from 'react'

function App() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-card max-w-md w-full text-center space-y-6">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-fuchsia-400">
          Justin Generator
        </h1>
        <p className="text-slate-300">
          Generate stunning AI portraits in seconds.
        </p>
        <div className="flex justify-center gap-4">
          <button className="btn-primary">
            Get Started
          </button>
          <button className="px-6 py-3 rounded-xl border border-glass-200 hover:bg-glass-100 transition-colors">
            Login
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
