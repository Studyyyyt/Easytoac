import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Easytoac · 激活码管理系统',
  description: '企业级激活码生成与授权验证平台',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body className="min-h-screen bg-[#0a0a0f] text-[#f0f0f5] antialiased">
        {children}
      </body>
    </html>
  )
}
