const Loading = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="flex flex-col items-center">
        
        {/* Robot Icon */}
        <div className="relative mb-8">
          {/* Glow */}
          <div className="absolute inset-0 bg-cyan-400/20 blur-3xl rounded-full scale-150" />

          <div className="relative w-28 h-28 bg-white rounded-[32px] shadow-2xl flex items-center justify-center border border-cyan-200">
            
            {/* Antenna */}
            <div className="absolute -top-6 flex flex-col items-center">
              <div className="w-1 h-5 bg-cyan-400 rounded-full" />
              <div className="w-3.5 h-3.5 bg-cyan-400 rounded-full shadow-[0_0_15px_#22d3ee]" />
            </div>

            {/* Robot Face */}
            <div className="w-20 h-14 bg-slate-900 rounded-2xl flex items-center justify-center gap-4 shadow-inner">
              <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_10px_#22d3ee]" />
              <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_10px_#22d3ee]" />
            </div>

            {/* Ears */}
            <div className="absolute -left-2 w-4 h-9 bg-cyan-400 rounded-full" />
            <div className="absolute -right-2 w-4 h-9 bg-cyan-400 rounded-full" />
          </div>
        </div>

        {/* Brand */}
        <div className="flex items-center mb-3">
          <span className="text-3xl font-bold text-white">
            Slot
          </span>
          <span className="text-3xl font-bold text-cyan-400">
            Bot
          </span>
        </div>

        <p className="text-slate-400 text-sm mb-8">
          Preparing your workspace...
        </p>

        {/* Loading Bar */}
        <div className="w-72 h-2 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 animate-loading-bar" />
        </div>

        {/* Loading Dots */}
        <div className="flex items-center gap-2 mt-5">
          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
          <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" />
        </div>

        <p className="text-xs text-slate-500 mt-4">
          Loading SlotBot
        </p>
      </div>
    </div>
  );
};

export default Loading;