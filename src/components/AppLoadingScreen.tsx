'use client';

import React from 'react';
import { Wrench, Sparkles } from 'lucide-react';

export function AppLoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Dynamic Background Glow Orbs */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '1s' }} />

      <div className="relative z-10 flex flex-col items-center max-w-sm w-full text-center space-y-6">
        {/* Animated Brand Emblem */}
        <div className="relative">
          <div className="absolute -inset-2 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 rounded-3xl blur-lg opacity-70 animate-pulse" />
          <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 flex items-center justify-center text-white shadow-2xl">
            <Wrench className="w-10 h-10 text-blue-400 animate-spin" style={{ animationDuration: '6s' }} />
          </div>
        </div>

        {/* Text and Indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-xl font-black tracking-tight text-white">
              Garage ERP
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
              Enterprise
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Car Wash, Detailing & Mechanical Workshop Portal
          </p>
        </div>

        {/* Pulsing Loading Bar */}
        <div className="w-48 h-1.5 bg-slate-800/80 rounded-full overflow-hidden relative">
          <div className="absolute inset-y-0 bg-gradient-to-r from-blue-500 via-indigo-400 to-blue-500 w-1/2 rounded-full animate-[shimmer_1.5s_infinite]" />
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
          <Sparkles className="w-3 h-3 text-amber-400 animate-bounce" />
          <span>Synchronizing live database...</span>
        </div>
      </div>
    </div>
  );
}
