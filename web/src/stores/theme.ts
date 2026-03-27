import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ==================== 主题定义 ====================
export interface ThemeConfig {
  id: string
  name: string
  author: string
  description: string
  // CSS 变量
  vars: Record<string, string>
}

// ==================== 辅助函数：从 hex 生成透明度变体 ====================
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null
}

function rgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return `rgba(0,0,0,${alpha})`
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

/** 根据主色和辅色生成完整的霓虹色透明度变体 */
function generateNeonVars(neonBlue: string, neonPurple: string, isDark: boolean) {
  // 计算一个中间色调（用于渐变按钮）
  const blueRgb = hexToRgb(neonBlue)
  const midBlue = blueRgb
    ? `rgba(${Math.round(blueRgb.r * 0.75)}, ${Math.round(blueRgb.g * 0.75)}, ${Math.round(blueRgb.b * 0.75)}, 0.90)`
    : rgba(neonBlue, 0.9)

  return {
    '--neon-blue-4': rgba(neonBlue, 0.04),
    '--neon-blue-5': rgba(neonBlue, 0.05),
    '--neon-blue-6': rgba(neonBlue, 0.06),
    '--neon-blue-8': rgba(neonBlue, 0.08),
    '--neon-blue-10': rgba(neonBlue, 0.10),
    '--neon-blue-12': rgba(neonBlue, 0.12),
    '--neon-blue-15': rgba(neonBlue, 0.15),
    '--neon-blue-20': rgba(neonBlue, 0.20),
    '--neon-blue-25': rgba(neonBlue, 0.25),
    '--neon-blue-30': rgba(neonBlue, 0.30),
    '--neon-blue-40': rgba(neonBlue, 0.40),
    '--neon-blue-50': rgba(neonBlue, 0.50),
    '--neon-blue-90': rgba(neonBlue, isDark ? 0.90 : 0.95),
    '--neon-blue-mid': midBlue,
    '--neon-purple-8': rgba(neonPurple, 0.08),
    '--neon-purple-10': rgba(neonPurple, 0.10),
    '--neon-purple-15': rgba(neonPurple, 0.15),
    '--neon-purple-20': rgba(neonPurple, 0.20),
    '--neon-purple-glow-text': neonPurple,
    '--neon-glow-shadow-sm': `0 0 ${isDark ? 6 : 4}px ${rgba(neonBlue, isDark ? 0.3 : 0.15)}`,
    '--neon-glow-shadow-md': `0 0 ${isDark ? 12 : 8}px ${rgba(neonBlue, isDark ? 0.3 : 0.18)}`,
    '--neon-glow-shadow-lg': `0 0 ${isDark ? 20 : 12}px ${rgba(neonBlue, isDark ? 0.4 : 0.20)}`,
    '--neon-glow-shadow-xl': `0 0 ${isDark ? 30 : 15}px ${rgba(neonBlue, isDark ? 0.3 : 0.15)}, 0 0 ${isDark ? 60 : 30}px ${rgba(neonBlue, isDark ? 0.1 : 0.05)}`,
    '--neon-glow-shadow-inset': `0 0 ${isDark ? 40 : 20}px ${rgba(neonBlue, isDark ? 0.15 : 0.08)}, inset 0 0 ${isDark ? 20 : 10}px ${rgba(neonBlue, isDark ? 0.05 : 0.03)}`,
  }
}

/** 根据主色生成完整的语义化变量集合（深色主题） */
function generateDarkThemeVars(opts: {
  bgBase: string
  bgSurface: string
  textPrimary: string
  textSecondary: string
  neonBlue: string
  neonPurple: string
  neonPink?: string
  neonGreen?: string
}): Record<string, string> {
  const { bgBase, bgSurface, textPrimary, textSecondary, neonBlue, neonPurple } = opts
  const neonPink = opts.neonPink || '#FF00FF'
  const neonGreen = opts.neonGreen || '#00FF88'

  return {
    '--neon-blue': neonBlue,
    '--neon-purple': neonPurple,
    '--neon-pink': neonPink,
    '--neon-green': neonGreen,
    '--bg-base': bgBase,
    '--bg-surface': bgSurface,
    '--bg-elevated': rgba(bgSurface, 0.85),
    '--bg-subtle': rgba(bgSurface, 0.4),
    '--bg-card': rgba(bgSurface, 0.6),
    '--bg-input': rgba(bgSurface, 0.6),
    '--bg-overlay': rgba(bgBase, 0.7),
    '--bg-tooltip': rgba(bgSurface, 0.9),
    '--bg-skeleton-from': rgba(neonBlue, 0.03),
    '--bg-skeleton-to': rgba(neonBlue, 0.06),
    '--text-primary': textPrimary,
    '--text-secondary': textSecondary,
    '--text-tertiary': rgba(textPrimary, 0.45),
    '--text-muted': rgba(textPrimary, 0.30),
    '--text-on-neon': bgBase,
    '--glass-bg': rgba(bgSurface, 0.6),
    '--glass-border': rgba(neonBlue, 0.08),
    '--glass-blur': '20px',
    '--border-default': rgba(neonBlue, 0.06),
    '--border-hover': rgba(neonBlue, 0.2),
    '--border-strong': rgba(neonBlue, 0.12),
    '--border-subtle': rgba(neonBlue, 0.04),
    '--shadow-card': `0 8px 32px rgba(0, 0, 0, 0.3)`,
    '--shadow-card-hover': `0 8px 32px ${rgba(neonBlue, 0.12)}, 0 0 1px ${rgba(neonBlue, 0.4)}`,
    '--shadow-elevated': `0 8px 32px rgba(0, 0, 0, 0.4)`,
    '--shadow-neon': `0 0 15px ${rgba(neonBlue, 0.2)}`,
    '--gradient-overlay-from': rgba(bgBase, 0.95),
    '--gradient-overlay-mid': rgba(bgBase, 0.5),
    '--selection-bg': rgba(neonBlue, 0.2),
    '--selection-text': '#fff',
    '--scrollbar-thumb': `linear-gradient(180deg, ${rgba(neonBlue, 0.3)}, ${rgba(neonPurple, 0.3)})`,
    '--scrollbar-thumb-hover': `linear-gradient(180deg, ${rgba(neonBlue, 0.5)}, ${rgba(neonPurple, 0.5)})`,
    '--focus-ring': rgba(neonBlue, 0.5),
    '--nav-hover-bg': rgba(neonBlue, 0.05),
    '--nav-active-bg': rgba(neonBlue, 0.08),
    '--noise-opacity': '0.015',
    '--progress-track-bg': 'rgba(255, 255, 255, 0.1)',
    '--progress-bar-glow': `0 0 8px ${rgba(neonBlue, 0.3)}`,
    '--spinner-border': rgba(neonBlue, 0.3),
    '--glass-panel-inset': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.03)',
    '--glass-panel-strong-inset': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
    '--modal-glow': `0 0 1px ${rgba(neonBlue, 0.2)}`,
    '--modal-panel-glow': `0 0 60px ${rgba(neonBlue, 0.06)}`,
    '--grid-line-color': rgba(neonBlue, 0.3),
    '--deco-glow-blue': rgba(neonBlue, 0.15),
    '--deco-glow-purple': rgba(neonPurple, 0.15),
    ...generateNeonVars(neonBlue, neonPurple, true),
  }
}

// 内置主题
export const builtinThemes: ThemeConfig[] = [
  {
    id: 'neon-dark',
    name: '霓虹暗夜',
    author: 'nowen',
    description: '默认深色主题，赛博朋克霓虹风格',
    vars: generateDarkThemeVars({
      bgBase: '#060a13',
      bgSurface: '#0b1120',
      textPrimary: '#ffffff',
      textSecondary: '#9fb3c8',
      neonBlue: '#00F0FF',
      neonPurple: '#8A2BE2',
      neonPink: '#FF00FF',
      neonGreen: '#00FF88',
    }),
  },
  {
    id: 'ocean-breeze',
    name: '海洋微风',
    author: 'nowen',
    description: '清新蓝色调深色主题',
    vars: generateDarkThemeVars({
      bgBase: '#0d1117',
      bgSurface: '#161b22',
      textPrimary: '#e6edf3',
      textSecondary: '#8b949e',
      neonBlue: '#58a6ff',
      neonPurple: '#bc8cff',
      neonPink: '#f778ba',
      neonGreen: '#56d364',
    }),
  },
  {
    id: 'forest-night',
    name: '暗夜森林',
    author: 'nowen',
    description: '自然绿色调深色主题',
    vars: generateDarkThemeVars({
      bgBase: '#0a100d',
      bgSurface: '#131f18',
      textPrimary: '#e0ede4',
      textSecondary: '#8ba89a',
      neonBlue: '#4ade80',
      neonPurple: '#22d3ee',
      neonPink: '#a78bfa',
      neonGreen: '#4ade80',
    }),
  },
  {
    id: 'warm-sunset',
    name: '暖色日暮',
    author: 'nowen',
    description: '温暖橙色调深色主题',
    vars: generateDarkThemeVars({
      bgBase: '#120e0a',
      bgSurface: '#1f1810',
      textPrimary: '#f5e6d3',
      textSecondary: '#b89e7a',
      neonBlue: '#fb923c',
      neonPurple: '#f472b6',
      neonPink: '#e879f9',
      neonGreen: '#a3e635',
    }),
  },
  {
    id: 'pure-light',
    name: '纯净白',
    author: 'nowen',
    description: '亮色主题，适合白天使用',
    vars: {
      '--neon-blue': '#0891B2',
      '--neon-purple': '#7C3AED',
      '--neon-pink': '#DB2777',
      '--neon-green': '#059669',
      '--glass-bg': 'rgba(255, 255, 255, 0.82)',
      '--glass-border': 'rgba(8, 145, 178, 0.15)',
      '--glass-blur': '20px',
      '--bg-base': '#f0f2f5',
      '--bg-surface': '#e4e8ed',
      '--bg-elevated': '#ffffff',
      '--bg-subtle': 'rgba(255, 255, 255, 0.7)',
      '--bg-card': 'rgba(255, 255, 255, 0.9)',
      '--bg-input': '#ffffff',
      '--bg-overlay': 'rgba(0, 0, 0, 0.35)',
      '--bg-tooltip': 'rgba(30, 41, 59, 0.95)',
      '--bg-skeleton-from': 'rgba(8, 145, 178, 0.06)',
      '--bg-skeleton-to': 'rgba(8, 145, 178, 0.12)',
      '--text-primary': '#1e293b',
      '--text-secondary': '#475569',
      '--text-tertiary': '#4b5563',
      '--text-muted': '#6b7280',
      '--text-on-neon': '#ffffff',
      '--border-default': 'rgba(0, 0, 0, 0.10)',
      '--border-hover': 'rgba(8, 145, 178, 0.30)',
      '--border-strong': 'rgba(8, 145, 178, 0.22)',
      '--border-subtle': 'rgba(0, 0, 0, 0.06)',
      '--shadow-card': '0 2px 8px rgba(0, 0, 0, 0.07), 0 1px 3px rgba(0, 0, 0, 0.05)',
      '--shadow-card-hover': '0 8px 24px rgba(8, 145, 178, 0.12), 0 0 1px rgba(8, 145, 178, 0.25)',
      '--shadow-elevated': '0 4px 20px rgba(0, 0, 0, 0.10), 0 1px 4px rgba(0, 0, 0, 0.06)',
      '--shadow-neon': '0 0 12px rgba(8, 145, 178, 0.18)',
      '--gradient-overlay-from': 'rgba(240, 242, 245, 0.95)',
      '--gradient-overlay-mid': 'rgba(240, 242, 245, 0.5)',
      '--selection-bg': 'rgba(8, 145, 178, 0.18)',
      '--selection-text': '#1e293b',
      '--scrollbar-thumb': 'linear-gradient(180deg, rgba(8, 145, 178, 0.30), rgba(124, 58, 237, 0.30))',
      '--scrollbar-thumb-hover': 'linear-gradient(180deg, rgba(8, 145, 178, 0.50), rgba(124, 58, 237, 0.50))',
      '--focus-ring': 'rgba(8, 145, 178, 0.5)',
      '--nav-hover-bg': 'rgba(8, 145, 178, 0.08)',
      '--nav-active-bg': 'rgba(8, 145, 178, 0.12)',
      '--noise-opacity': '0.008',
      '--progress-track-bg': 'rgba(0, 0, 0, 0.06)',
      '--progress-bar-glow': '0 0 6px rgba(8, 145, 178, 0.20)',
      '--spinner-border': 'rgba(8, 145, 178, 0.30)',
      '--glass-panel-inset': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.6)',
      '--glass-panel-strong-inset': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.8)',
      '--modal-glow': '0 0 1px rgba(8, 145, 178, 0.15)',
      '--modal-panel-glow': '0 0 30px rgba(8, 145, 178, 0.04)',
      '--grid-line-color': 'rgba(8, 145, 178, 0.12)',
      '--deco-glow-blue': 'rgba(8, 145, 178, 0.08)',
      '--deco-glow-purple': 'rgba(124, 58, 237, 0.06)',
      ...generateNeonVars('#0891B2', '#7C3AED', false),
    },
  },
]

// 亮色主题 ID 列表
const lightThemeIds = new Set(['pure-light'])

// 根据主题 ID 判断是 dark 还是 light
function resolveMode(themeId: string): 'dark' | 'light' {
  return lightThemeIds.has(themeId) ? 'light' : 'dark'
}

// ==================== 主题 Store ====================
interface ThemeStore {
  currentThemeId: string
  theme: 'dark' | 'light'
  customThemes: ThemeConfig[]
  setTheme: (id: string) => void
  toggleTheme: () => void
  addCustomTheme: (theme: ThemeConfig) => void
  removeCustomTheme: (id: string) => void
  getAllThemes: () => ThemeConfig[]
  getCurrentTheme: () => ThemeConfig | undefined
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      currentThemeId: 'neon-dark',
      theme: 'dark' as const,
      customThemes: [],

      setTheme: (id: string) => {
        const mode = resolveMode(id)
        set({ currentThemeId: id, theme: mode })
        applyTheme(id, [...builtinThemes, ...get().customThemes])
      },

      toggleTheme: () => {
        const { theme, currentThemeId, customThemes } = get()
        // dark → pure-light，light → 上一个深色主题（默认 neon-dark）
        if (theme === 'dark') {
          const newId = 'pure-light'
          set({ currentThemeId: newId, theme: 'light' })
          applyTheme(newId, [...builtinThemes, ...customThemes])
        } else {
          // 切回默认深色主题，若之前用的是深色主题则保留
          const fallbackDark = lightThemeIds.has(currentThemeId) ? 'neon-dark' : currentThemeId
          set({ currentThemeId: fallbackDark, theme: 'dark' })
          applyTheme(fallbackDark, [...builtinThemes, ...customThemes])
        }
      },

      addCustomTheme: (theme: ThemeConfig) => {
        set((state) => ({
          customThemes: [...state.customThemes.filter((t) => t.id !== theme.id), theme],
        }))
      },

      removeCustomTheme: (id: string) => {
        set((state) => ({
          customThemes: state.customThemes.filter((t) => t.id !== id),
          currentThemeId: state.currentThemeId === id ? 'neon-dark' : state.currentThemeId,
        }))
      },

      getAllThemes: () => [...builtinThemes, ...get().customThemes],

      getCurrentTheme: () => {
        const all = [...builtinThemes, ...get().customThemes]
        return all.find((t) => t.id === get().currentThemeId)
      },
    }),
    {
      name: 'nowen-theme',
    }
  )
)

// 记录上一次应用的主题变量 key，用于切换时清理旧值
let lastAppliedKeys: string[] = []

// ==================== 主题应用函数 ====================
export function applyTheme(themeId: string, allThemes: ThemeConfig[]) {
  const theme = allThemes.find((t) => t.id === themeId)
  if (!theme) return

  const root = document.documentElement

  // 设置 data-theme 属性，驱动 CSS 中的 [data-theme="dark"] / [data-theme="light"]
  root.setAttribute('data-theme', resolveMode(themeId))

  // 先清除上一次主题设置的内联样式，避免残留
  lastAppliedKeys.forEach((key) => {
    root.style.removeProperty(key)
  })

  // 应用新主题变量
  const newKeys = Object.keys(theme.vars)
  Object.entries(theme.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
  lastAppliedKeys = newKeys
}

// 初始化主题（App 启动时调用）
export function initTheme() {
  const state = useThemeStore.getState()
  const allThemes = [...builtinThemes, ...state.customThemes]
  applyTheme(state.currentThemeId, allThemes)
}
