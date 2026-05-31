'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ConfirmModal'

// 定义激活码接口
interface ActivationCode {
  id: number
  code: string
  isUsed: boolean
  usedAt: string | null
  usedBy: string | null
  createdAt: string
  expiresAt: string | null
  validDays: number | null
  cardType: string | null
}

// 定义统计数据接口
interface Stats {
  total: number
  used: number
  expired: number
  active: number
}

// 定义套餐类型
interface CardType {
  name: string
  days: number
  description: string
}

type TabType = 'generate' | 'list' | 'stats' | 'changePassword' | 'systemConfig'

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<TabType>('stats')
  const [amount, setAmount] = useState(1)
  const [expiryDays, setExpiryDays] = useState(30)
  const [selectedCardType, setSelectedCardType] = useState<string>('')
  const [customDays, setCustomDays] = useState(30)
  const [loading, setLoading] = useState(false)
  const [generatedCodes, setGeneratedCodes] = useState<ActivationCode[]>([])
  const [allCodes, setAllCodes] = useState<ActivationCode[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, used: 0, expired: 0, active: 0 })
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('success')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'unused' | 'used' | 'expired'>('all')
  const [cardTypeFilter, setCardTypeFilter] = useState<'all' | string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [systemConfigs, setSystemConfigs] = useState<any[]>([])
  const router = useRouter()

  // 自定义确认对话框状态
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    confirmText: string
    confirmVariant: 'danger' | 'primary' | 'warning'
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '确认',
    confirmVariant: 'danger',
    onConfirm: () => {},
  })

  const openConfirm = (options: Omit<typeof confirmModal, 'isOpen'>) => {
    setConfirmModal({ ...options, isOpen: true })
  }

  const closeConfirm = () => {
    setConfirmModal((prev) => ({ ...prev, isOpen: false }))
  }

  const cardTypes: CardType[] = [
    { name: '周卡', days: 7, description: '7天有效期' },
    { name: '月卡', days: 30, description: '30天有效期' },
    { name: '季卡', days: 90, description: '90天有效期' },
    { name: '半年卡', days: 180, description: '180天有效期' },
    { name: '年卡', days: 365, description: '365天有效期' },
    { name: '自定义', days: 0, description: '自定义天数' }
  ]

  const getActualExpiresAt = (code: ActivationCode): Date | null => {
    if (code.usedAt && code.validDays) {
      return new Date(new Date(code.usedAt).getTime() + code.validDays * 24 * 60 * 60 * 1000)
    }
    return code.expiresAt ? new Date(code.expiresAt) : null
  }

  const handleCardTypeChange = (cardType: string) => {
    setSelectedCardType(cardType)
    const selectedCard = cardTypes.find(card => card.name === cardType)
    if (selectedCard && selectedCard.days > 0) {
      setExpiryDays(selectedCard.days)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/codes/stats')
      const data = await response.json()
      if (data.success) {
        setStats(data.stats)
      }
    } catch (error) {
      console.error('获取统计数据失败:', error)
    }
  }

  const fetchSystemConfigs = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/system-config')
      const data = await response.json()
      if (data.success) {
        setSystemConfigs(data.configs)
      } else {
        setMessage(data.message || '获取系统配置失败')
        setMessageType('error')
      }
    } catch (error) {
      setMessage('网络错误，请重试')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const fetchAllCodes = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/codes/list')
      const data = await response.json()
      if (data.success) {
        setAllCodes(data.codes)
      } else {
        setMessage(data.message || '获取激活码列表失败')
        setMessageType('error')
      }
    } catch (error) {
      setMessage('网络错误，请重试')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCode = async (id: number) => {
    openConfirm({
      title: '删除确认',
      message: '确定要删除这个激活码吗？删除后不可恢复。',
      confirmText: '删除',
      confirmVariant: 'danger',
      onConfirm: async () => {
        closeConfirm()
        try {
          const response = await fetch(`/api/admin/codes/delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          })
          const data = await response.json()
          if (data.success) {
            setMessage('激活码删除成功')
            setMessageType('success')
            fetchAllCodes()
            fetchStats()
          } else {
            setMessage(data.message || '删除失败')
            setMessageType('error')
          }
        } catch (error) {
          setMessage('网络错误，请重试')
          setMessageType('error')
        }
      },
    })
  }

  const handleCleanupExpired = async () => {
    openConfirm({
      title: '清理过期绑定',
      message: '确定要清理所有过期激活码的绑定关系吗？这将允许之前绑定过期激活码的机器使用新激活码。',
      confirmText: '清理',
      confirmVariant: 'warning',
      onConfirm: async () => {
        closeConfirm()
        try {
          setLoading(true)
          const response = await fetch('/api/admin/codes/cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
          const data = await response.json()
          if (data.success) {
            setMessage(data.message)
            setMessageType('success')
            fetchAllCodes()
            fetchStats()
          } else {
            setMessage(data.message || '清理失败')
            setMessageType('error')
          }
        } catch (error) {
          setMessage('网络错误，请重试')
          setMessageType('error')
        } finally {
          setLoading(false)
        }
      },
    })
  }

  useEffect(() => {
    fetchStats()
    if (activeTab === 'list') fetchAllCodes()
    if (activeTab === 'systemConfig') fetchSystemConfigs()
  }, [activeTab])

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
      router.push('/admin/login')
    } catch (error) {
      console.error('登出失败:', error)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage('请填写所有密码字段')
      setMessageType('error')
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage('新密码与确认密码不匹配')
      setMessageType('error')
      return
    }
    if (newPassword.length < 6) {
      setMessage('新密码长度不能少于6位')
      setMessageType('error')
      return
    }
    setLoading(true)
    try {
      const response = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await response.json()
      if (data.success) {
        setMessage(data.message)
        setMessageType('success')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        setTimeout(() => handleLogout(), 3000)
      } else {
        setMessage(data.message || '密码修改失败')
        setMessageType('error')
      }
    } catch (error) {
      setMessage('网络错误，请重试')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateSystemConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch('/api/admin/system-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configs: systemConfigs }),
      })
      const data = await response.json()
      if (data.success) {
        setMessage(data.message)
        setMessageType('success')
      } else {
        setMessage(data.message || '系统配置更新失败')
        setMessageType('error')
      }
    } catch (error) {
      setMessage('网络错误，请重试')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const updateConfigValue = (key: string, value: any) => {
    setSystemConfigs(prev => prev.map(config => config.key === key ? { ...config, value } : config))
  }

  const handleGenerateCodes = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    try {
      setLoading(true)
      const finalExpiryDays = selectedCardType === '自定义' ? customDays : expiryDays
      const finalCardType = selectedCardType || null
      const response = await fetch('/api/admin/codes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, expiryDays: finalExpiryDays, cardType: finalCardType }),
      })
      const data = await response.json()
      if (data.success) {
        setGeneratedCodes(data.codes)
        setMessage(data.message)
        setMessageType('success')
        fetchStats()
      } else {
        setMessage(data.message || '生成失败')
        setMessageType('error')
      }
    } catch (error) {
      setMessage('网络错误，请重试')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setMessage('已复制到剪贴板')
    setMessageType('success')
  }

  const exportCodes = (codes: ActivationCode[]) => {
    const csvContent = "data:text/csv;charset=utf-8,"
      + "激活码,套餐类型,状态,创建时间,过期时间,使用时间,使用者\n"
      + codes.map(code => {
        let status = '未激活'
        let expiresDisplay = '激活后生效'
        const actualExpiresAt = getActualExpiresAt(code)
        const isExpired = actualExpiresAt ? actualExpiresAt < new Date() : false
        if (isExpired) {
          status = '已过期'
          expiresDisplay = actualExpiresAt ? actualExpiresAt.toLocaleString() : '无限期'
        } else if (code.isUsed) {
          status = '已使用'
          expiresDisplay = actualExpiresAt ? actualExpiresAt.toLocaleString() : '无限期'
        } else if (!code.validDays) {
          expiresDisplay = '无限期'
        }
        const cardTypeDisplay = getCardTypeDisplay(code)
        return `${code.code},${cardTypeDisplay},${status},${new Date(code.createdAt).toLocaleString()},${expiresDisplay},${code.usedAt ? new Date(code.usedAt).toLocaleString() : ''},${code.usedBy || ''}`
      }).join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `activation_codes_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const filteredCodes = allCodes.filter(code => {
    const matchesSearch = code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (code.usedBy && code.usedBy.toLowerCase().includes(searchTerm.toLowerCase()))
    const now = new Date()
    const actualExpiresAt = getActualExpiresAt(code)
    const isExpired = actualExpiresAt ? actualExpiresAt < now : false
    let matchesStatus = true
    switch (statusFilter) {
      case 'unused': matchesStatus = !code.isUsed && !isExpired; break
      case 'used': matchesStatus = code.isUsed && !isExpired; break
      case 'expired': matchesStatus = isExpired; break
    }
    let matchesCardType = true
    if (cardTypeFilter !== 'all') {
      matchesCardType = cardTypeFilter === 'none' ? !code.cardType : code.cardType === cardTypeFilter
    }
    return matchesSearch && matchesStatus && matchesCardType
  })

  const totalPages = Math.ceil(filteredCodes.length / itemsPerPage)
  const paginatedCodes = filteredCodes.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const getStatusBadge = (code: ActivationCode) => {
    const now = new Date()
    const actualExpiresAt = getActualExpiresAt(code)
    const isExpired = actualExpiresAt ? actualExpiresAt < now : false
    if (isExpired) {
      return (
        <span className="status-badge bg-red-500/10 text-red-400 border border-red-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          已过期
        </span>
      )
    } else if (code.isUsed) {
      return (
        <span className="status-badge bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          已使用
        </span>
      )
    } else {
      return (
        <span className="status-badge bg-accent-500/10 text-accent-400 border border-accent-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-400" />
          未激活
        </span>
      )
    }
  }

  const getCardTypeDisplay = (code: ActivationCode) => {
    if (code.cardType) return code.cardType
    if (code.validDays) return `${code.validDays}天`
    return '无限期'
  }

  const getAvailableCardTypes = () => {
    const types = new Set<string>()
    allCodes.forEach(code => { if (code.cardType) types.add(code.cardType) })
    return Array.from(types).sort()
  }

  const tabs = [
    { key: 'stats' as TabType, label: '数据统计', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
    )},
    { key: 'generate' as TabType, label: '生成激活码', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg>
    )},
    { key: 'list' as TabType, label: '激活码管理', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V19.5a2.25 2.25 0 002.25 2.25h.75" /></svg>
    )},
    { key: 'changePassword' as TabType, label: '修改密码', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
    )},
    { key: 'systemConfig' as TabType, label: '系统配置', icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
    )},
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0f] bg-dot-grid">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-40 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-accent-500 to-accent-400 opacity-20" />
              <div className="absolute inset-0 rounded-lg border border-accent-500/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-accent-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
            </div>
            <span className="font-bold text-lg tracking-tight">Easytoac</span>
          </div>

          <nav className="hidden md:flex items-center gap-1">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-accent-500/10 text-accent-400'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            登出
          </button>
        </div>
      </header>

      {/* 移动端标签导航 */}
      <div className="md:hidden border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="flex overflow-x-auto px-4 py-2 gap-1 scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'bg-accent-500/10 text-accent-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 主内容区 */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* 确认对话框 */}
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          confirmVariant={confirmModal.confirmVariant}
          onConfirm={confirmModal.onConfirm}
          onCancel={closeConfirm}
        />

        {/* 消息提示 */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl border flex items-center gap-3 ${
            messageType === 'success'
              ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/5 border-red-500/20 text-red-400'
          }`}>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {messageType === 'success' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              )}
            </svg>
            {message}
          </div>
        )}

        {/* 数据统计 */}
        {activeTab === 'stats' && (
          <div className="space-y-6 animate-fade-in">
            {/* 统计卡片 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: '总激活码数', value: stats.total, icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
                ), color: 'accent', desc: '全部激活码' },
                { label: '已使用', value: stats.used, icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                ), color: 'emerald', desc: '已绑定设备' },
                { label: '已过期', value: stats.expired, icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
                ), color: 'red', desc: '需清理' },
                { label: '可用', value: stats.active, icon: (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
                ), color: 'amber', desc: '未使用' },
              ].map((item, i) => (
                <div key={i} className="stat-card">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      item.color === 'accent' ? 'bg-accent-500/10 text-accent-400' :
                      item.color === 'emerald' ? 'bg-emerald-500/10 text-emerald-400' :
                      item.color === 'red' ? 'bg-red-500/10 text-red-400' :
                      'bg-amber-500/10 text-amber-400'
                    }`}>
                      {item.icon}
                    </div>
                    <span className="text-xs text-gray-600">{item.desc}</span>
                  </div>
                  <div className="text-3xl font-bold font-mono text-white">{item.value}</div>
                  <div className="text-sm text-gray-500 mt-1">{item.label}</div>
                </div>
              ))}
            </div>

            {/* 使用率统计 */}
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-6">使用率分布</h3>
              <div className="space-y-5">
                {[
                  { label: '已使用', value: stats.total > 0 ? Math.round((stats.used / stats.total) * 100) : 0, color: 'bg-emerald-500' },
                  { label: '已过期', value: stats.total > 0 ? Math.round((stats.expired / stats.total) * 100) : 0, color: 'bg-red-500' },
                  { label: '可用', value: stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0, color: 'bg-accent-500' },
                ].map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-400">{item.label}</span>
                      <span className="text-white font-mono">{item.value}%</span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-1000 ${item.color}`} style={{ width: `${item.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 生成激活码 */}
        {activeTab === 'generate' && (
          <div className="space-y-6 animate-fade-in max-w-2xl">
            <div className="glass-card rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-accent-500/10 border border-accent-500/20 flex items-center justify-center text-accent-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">生成激活码</h2>
                  <p className="text-sm text-gray-500">批量创建新的激活码</p>
                </div>
              </div>

              <form onSubmit={handleGenerateCodes} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">生成数量</label>
                    <input type="number" min="1" max="100" value={amount} onChange={(e) => setAmount(parseInt(e.target.value))} className="input-dark w-full" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">套餐类型</label>
                    <select value={selectedCardType} onChange={(e) => handleCardTypeChange(e.target.value)} className="select-dark w-full">
                      <option value="">请选择</option>
                      {cardTypes.map((ct) => <option key={ct.name} value={ct.name}>{ct.name} ({ct.description})</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">有效期（天）</label>
                  <input
                    type="number" min="1"
                    value={selectedCardType === '自定义' ? customDays : expiryDays}
                    onChange={(e) => {
                      const v = parseInt(e.target.value)
                      selectedCardType === '自定义' ? setCustomDays(v) : setExpiryDays(v)
                    }}
                    disabled={selectedCardType !== '自定义' && selectedCardType !== ''}
                    className="input-dark w-full disabled:opacity-50"
                    required
                  />
                  {selectedCardType && selectedCardType !== '自定义' && (
                    <p className="text-xs text-gray-600 mt-2">已选择 {selectedCardType}，自动设置为 {expiryDays} 天</p>
                  )}
                </div>

                <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                  {loading ? <><div className="loading-spinner" /><span>生成中...</span></> : <span>生成激活码</span>}
                </button>
              </form>
            </div>

            {generatedCodes.length > 0 && (
              <div className="glass-card rounded-2xl p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-white">本次生成结果</h3>
                  <button onClick={() => exportCodes(generatedCodes)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                    导出 CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="table-dark">
                    <thead>
                      <tr>
                        <th>激活码</th><th>套餐</th><th>有效期</th><th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generatedCodes.map((code) => (
                        <tr key={code.id}>
                          <td className="font-mono text-white">{code.code}</td>
                          <td>{getCardTypeDisplay(code)}</td>
                          <td>{code.validDays ? `${code.validDays}天（激活后生效）` : '无限期'}</td>
                          <td>
                            <button onClick={() => copyToClipboard(code.code)} className="text-accent-400 hover:text-accent-300 text-sm font-medium transition-colors">复制</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 激活码管理 */}
        {activeTab === 'list' && (
          <div className="space-y-6 animate-fade-in">
            {/* 筛选 */}
            <div className="glass-card rounded-2xl p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">搜索</label>
                  <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input-dark w-full" placeholder="激活码或机器ID" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">状态</label>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="select-dark w-full">
                    <option value="all">全部状态</option>
                    <option value="unused">未激活</option>
                    <option value="used">已使用</option>
                    <option value="expired">已过期</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">套餐</label>
                  <select value={cardTypeFilter} onChange={(e) => setCardTypeFilter(e.target.value)} className="select-dark w-full">
                    <option value="all">全部套餐</option>
                    {getAvailableCardTypes().map((ct) => <option key={ct} value={ct}>{ct}</option>)}
                    <option value="none">无套餐</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button onClick={() => exportCodes(filteredCodes)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                    导出
                  </button>
                </div>
              </div>
            </div>

            {/* 列表 */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">
                  激活码列表 <span className="text-gray-600 font-mono text-sm ml-2">({filteredCodes.length})</span>
                </h3>
                <button onClick={handleCleanupExpired} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all disabled:opacity-50">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" /></svg>
                  清理过期绑定
                </button>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="loading-spinner mx-auto" />
                  <p className="mt-4 text-gray-500">加载中...</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto -mx-6 px-6">
                    <table className="table-dark">
                      <thead>
                        <tr>
                          <th>激活码</th>
                          <th>状态</th>
                          <th>套餐</th>
                          <th>创建时间</th>
                          <th>过期时间</th>
                          <th>使用时间</th>
                          <th>使用者</th>
                          <th className="text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedCodes.map((code) => (
                          <tr key={code.id}>
                            <td className="font-mono text-white">{code.code}</td>
                            <td>{getStatusBadge(code)}</td>
                            <td>{getCardTypeDisplay(code)}</td>
                            <td>{new Date(code.createdAt).toLocaleString()}</td>
                            <td>{!code.isUsed ? (code.validDays ? '激活后生效' : '无限期') : (getActualExpiresAt(code)?.toLocaleString() || '无限期')}</td>
                            <td>{code.usedAt ? new Date(code.usedAt).toLocaleString() : '-'}</td>
                            <td className="font-mono text-xs">{code.usedBy || '-'}</td>
                            <td className="text-right">
                              <div className="flex items-center justify-end gap-3">
                                <button onClick={() => copyToClipboard(code.code)} className="p-1.5 rounded-lg text-gray-500 hover:text-accent-400 hover:bg-accent-500/10 transition-all" title="复制">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5" /></svg>
                                </button>
                                <button onClick={() => handleDeleteCode(code.id)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all" title="删除">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 分页 */}
                  {totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        第 {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredCodes.length)} 条，共 {filteredCodes.length} 条
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1.5 rounded-lg text-sm bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 disabled:opacity-30 transition-all">
                          上一页
                        </button>
                        <div className="flex gap-1">
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button key={page} onClick={() => setCurrentPage(page)} className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${currentPage === page ? 'bg-accent-500 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                              {page}
                            </button>
                          ))}
                        </div>
                        <button onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-1.5 rounded-lg text-sm bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 disabled:opacity-30 transition-all">
                          下一页
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* 修改密码 */}
        {activeTab === 'changePassword' && (
          <div className="animate-fade-in max-w-md mx-auto">
            <div className="glass-card rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-accent-500/10 border border-accent-500/20 flex items-center justify-center text-accent-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">修改密码</h2>
                  <p className="text-sm text-gray-500">更新管理员登录密码</p>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">当前密码</label>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="input-dark w-full" placeholder="请输入当前密码" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">新密码</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-dark w-full" placeholder="至少6位字符" required minLength={6} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">确认新密码</label>
                  <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="input-dark w-full" placeholder="再次输入新密码" required minLength={6} />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                  {loading ? <><div className="loading-spinner" /><span>修改中...</span></> : <span>确认修改</span>}
                </button>
              </form>

              <div className="mt-6 p-4 rounded-xl bg-amber-500/5 border border-amber-500/15">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <div className="text-sm text-amber-400/80">
                    <p className="font-medium text-amber-400 mb-1">注意</p>
                    <p>密码修改成功后将自动登出，需使用新密码重新登录。</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 系统配置 */}
        {activeTab === 'systemConfig' && (
          <div className="animate-fade-in max-w-2xl">
            <div className="glass-card rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-accent-500/10 border border-accent-500/20 flex items-center justify-center text-accent-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">系统配置</h2>
                  <p className="text-sm text-gray-500">管理全局系统参数</p>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="loading-spinner mx-auto" />
                  <p className="mt-4 text-gray-500">加载中...</p>
                </div>
              ) : (
                <form onSubmit={handleUpdateSystemConfig} className="space-y-6">
                  {systemConfigs.map((config) => (
                    <div key={config.key} className="pb-6 border-b border-white/5 last:border-0 last:pb-0">
                      <div className="flex justify-between items-start mb-3">
                        <label className="text-sm font-medium text-gray-300">{config.key}</label>
                        <span className="text-xs text-gray-600">{config.description}</span>
                      </div>

                      {config.key === 'allowedIPs' ? (
                        <textarea
                          value={Array.isArray(config.value) ? config.value.join('\n') : config.value}
                          onChange={(e) => updateConfigValue(config.key, e.target.value.split('\n').filter(ip => ip.trim()))}
                          className="input-dark w-full"
                          rows={4}
                          placeholder="127.0.0.1&#10;::1"
                        />
                      ) : config.key === 'bcryptRounds' ? (
                        <div>
                          <input type="number" min="4" max="15" value={config.value} onChange={(e) => updateConfigValue(config.key, parseInt(e.target.value))} className="input-dark w-full" />
                          <p className="text-xs text-gray-600 mt-2">推荐值：10-12（值越大越安全但计算越慢）</p>
                        </div>
                      ) : config.key === 'jwtExpiresIn' ? (
                        <select value={config.value} onChange={(e) => updateConfigValue(config.key, e.target.value)} className="select-dark w-full">
                          <option value="1h">1小时</option>
                          <option value="6h">6小时</option>
                          <option value="12h">12小时</option>
                          <option value="24h">24小时</option>
                          <option value="7d">7天</option>
                        </select>
                      ) : (
                        <input type="text" value={config.value} onChange={(e) => updateConfigValue(config.key, e.target.value)} className="input-dark w-full" placeholder={`请输入${config.description || config.key}`} />
                      )}
                    </div>
                  ))}

                  <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                    {loading ? <><div className="loading-spinner" /><span>保存中...</span></> : <span>保存配置</span>}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
