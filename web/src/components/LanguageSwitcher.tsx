import { useState, useRef, useEffect } from 'react'
import { useI18nStore, SUPPORTED_LOCALES } from '@/i18n'
import { Globe } from 'lucide-react'
import clsx from 'clsx'

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18nStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const currentLang = SUPPORTED_LOCALES.find(l => l.code === locale)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-surface-400 hover:text-white hover:bg-white/5 transition-colors w-full"
      >
        <Globe className="h-4 w-4" />
        <span>{currentLang?.flag} {currentLang?.name}</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-48 rounded-xl py-1 z-50" style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--neon-blue-15)',
          backdropFilter: 'blur(20px)',
        }}>
          {SUPPORTED_LOCALES.map(lang => (
            <button
              key={lang.code}
              onClick={() => { setLocale(lang.code); setOpen(false) }}
              className={clsx(
                'flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors',
                locale === lang.code
                  ? 'text-neon-blue bg-neon-blue/5'
                  : 'text-surface-300 hover:text-white hover:bg-white/5'
              )}
            >
              <span className="text-base">{lang.flag}</span>
              <span>{lang.name}</span>
              {locale === lang.code && (
                <span className="ml-auto text-xs text-neon-blue">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
