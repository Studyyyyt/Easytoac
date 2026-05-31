export default function Home() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-dot-grid">
      {/* 背景光晕 */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-accent-400/3 blur-[100px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-5xl mx-auto px-6">
        {/* Logo + 标题 */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-accent-500 to-accent-400 opacity-20" />
              <div className="absolute inset-0 rounded-xl border border-accent-500/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
            </div>
            <span className="text-2xl font-bold tracking-tight">
              Easytoac
            </span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4 bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
            激活码管理系统
          </h1>
          <p className="text-lg text-gray-500 max-w-lg mx-auto">
            企业级授权验证平台 · 安全 · 高效 · 可追踪
          </p>
        </div>

        {/* 主卡片 */}
        <div className="max-w-md mx-auto animate-slide-up">
          <div className="glass-card rounded-2xl p-8 glow-accent">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse-glow" />
              <span className="text-sm font-mono text-gray-400">SYSTEM READY</span>
            </div>

            <h2 className="text-xl font-semibold mb-2 text-white">
              欢迎使用
            </h2>
            <p className="text-sm text-gray-500 mb-8">
              管理您的软件授权与激活码分发
            </p>

            <a
              href="/admin/login"
              className="btn-primary w-full flex items-center justify-center gap-2 text-center"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
              </svg>
              进入管理后台
            </a>
          </div>
        </div>

        {/* 功能特性 */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto animate-slide-up" style={{ animationDelay: '0.15s' }}>
          {[
            {
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              ),
              title: '批量生成',
              desc: '一键生成多个激活码，支持自定义套餐类型与有效期',
            },
            {
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                </svg>
              ),
              title: '授权验证',
              desc: '设备绑定机制，一机一码，防止激活码滥用',
            },
            {
              icon: (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
              ),
              title: '数据统计',
              desc: '实时追踪激活码使用状态，可视化数据看板',
            },
          ].map((item, i) => (
            <div
              key={i}
              className="glass-card rounded-xl p-5 hover:border-accent-500/30 transition-all duration-300 group"
            >
              <div className="w-10 h-10 rounded-lg bg-accent-500/10 border border-accent-500/20 flex items-center justify-center text-accent-400 mb-4 group-hover:scale-110 transition-transform">
                {item.icon}
              </div>
              <h3 className="font-semibold text-white mb-1">{item.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* 页脚 */}
        <footer className="mt-20 text-center text-xs text-gray-600">
          <p>Easytoac Activation Code Management System</p>
        </footer>
      </div>
    </main>
  )
}
