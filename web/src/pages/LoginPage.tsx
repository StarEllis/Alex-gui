import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { authApi } from '@/api'
import { useTranslation } from '@/i18n'
import { Zap } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const { t } = useTranslation()

  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const api = isRegister ? authApi.register : authApi.login
      const res = await api({ username, password })
      setAuth(res.data.token, res.data.user)
      navigate('/')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setError(axiosErr.response?.data?.error || t('auth.operationFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* 深空背景：多层光效 */}
      <div className="pointer-events-none absolute inset-0">
        {/* 主光晕 */}
        <div
          className="absolute top-1/4 left-1/4 h-[500px] w-[500px] rounded-full opacity-30 blur-[120px]"
          style={{ background: 'radial-gradient(circle, var(--deco-glow-blue), transparent)' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 h-[400px] w-[400px] rounded-full opacity-20 blur-[100px]"
          style={{ background: 'radial-gradient(circle, var(--deco-glow-purple), transparent)' }}
        />
        {/* 网格线（科技感） */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `
              linear-gradient(var(--grid-line-color) 1px, transparent 1px),
              linear-gradient(90deg, var(--grid-line-color) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-sm animate-scale-in">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div
            className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl animate-float"
            style={{
              background: 'linear-gradient(135deg, var(--neon-blue), var(--neon-purple))',
              boxShadow: 'var(--neon-glow-shadow-xl)',
            }}
          >
            <Zap size={32} className="text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-wider" style={{ color: 'var(--text-primary)' }}>
            <span className="text-neon text-neon-glow">N</span>OWEN
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('auth.slogan')}
          </p>
        </div>

        {/* 表单 */}
        <form
          onSubmit={handleSubmit}
          className="glass-panel rounded-2xl p-6"
        >
          {/* 表单顶部霓虹线 */}
          <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-neon-blue/30 to-transparent" />

          <h2 className="mb-6 text-center font-display text-base font-semibold tracking-wider" style={{ color: 'var(--text-primary)' }}>
            {isRegister ? t('auth.registerTitle') : t('auth.loginTitle')}
          </h2>

          {error && (
            <div className="mb-4 rounded-xl px-4 py-3 text-sm text-red-400"
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
              }}
            >
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                {t('auth.username')}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                placeholder={t('auth.usernamePlaceholder')}
                required
                minLength={3}
                autoFocus
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                {t('auth.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder={t('auth.passwordPlaceholder')}
                required
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-6 w-full py-3"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {t('auth.processing')}
              </span>
            ) : isRegister ? t('auth.register') : t('auth.enterDeepSpace')}
          </button>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister)
                setError('')
              }}
              className="text-sm transition-colors hover:text-neon"
              style={{ color: 'var(--text-secondary)' }}
            >
              {isRegister ? t('auth.switchToLogin') : t('auth.switchToRegister')}
            </button>
          </div>
        </form>

        {/* 默认账号提示 */}
        {!isRegister && (
          <p className="mt-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            {t('auth.defaultAccount')}
          </p>
        )}
      </div>
    </div>
  )
}
