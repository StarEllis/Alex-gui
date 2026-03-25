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

// 内置主题
export const builtinThemes: ThemeConfig[] = [
  {
    id: 'neon-dark',
    name: '霓虹暗夜',
    author: 'nowen',
    description: '默认深色主题，赛博朋克霓虹风格',
    vars: {
      '--bg-base': '#0a0a0a',
      '--bg-surface': '#141414',
      '--text-primary': '#f0f0f0',
      '--text-secondary': '#a0a0a0',
      '--neon-blue': '#00f0ff',
      '--neon-purple': '#8a2be2',
    },
  },
  {
    id: 'ocean-breeze',
    name: '海洋微风',
    author: 'nowen',
    description: '清新蓝色调深色主题',
    vars: {
      '--bg-base': '#0d1117',
      '--bg-surface': '#161b22',
      '--text-primary': '#e6edf3',
      '--text-secondary': '#8b949e',
      '--neon-blue': '#58a6ff',
      '--neon-purple': '#bc8cff',
    },
  },
  {
    id: 'forest-night',
    name: '暗夜森林',
    author: 'nowen',
    description: '自然绿色调深色主题',
    vars: {
      '--bg-base': '#0a100d',
      '--bg-surface': '#131f18',
      '--text-primary': '#e0ede4',
      '--text-secondary': '#8ba89a',
      '--neon-blue': '#4ade80',
      '--neon-purple': '#22d3ee',
    },
  },
  {
    id: 'warm-sunset',
    name: '暖色日暮',
    author: 'nowen',
    description: '温暖橙色调深色主题',
    vars: {
      '--bg-base': '#120e0a',
      '--bg-surface': '#1f1810',
      '--text-primary': '#f5e6d3',
      '--text-secondary': '#b89e7a',
      '--neon-blue': '#fb923c',
      '--neon-purple': '#f472b6',
    },
  },
  {
    id: 'pure-light',
    name: '纯净白',
    author: 'nowen',
    description: '亮色主题，适合白天使用',
    vars: {
      '--bg-base': '#ffffff',
      '--bg-surface': '#f5f5f5',
      '--text-primary': '#1a1a1a',
      '--text-secondary': '#666666',
      '--neon-blue': '#2563eb',
      '--neon-purple': '#7c3aed',
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

// ==================== 主题应用函数 ====================
export function applyTheme(themeId: string, allThemes: ThemeConfig[]) {
  const theme = allThemes.find((t) => t.id === themeId)
  if (!theme) return

  const root = document.documentElement

  // 设置 data-theme 属性，驱动 CSS 中的 [data-theme="dark"] / [data-theme="light"]
  root.setAttribute('data-theme', resolveMode(themeId))

  Object.entries(theme.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
}

// 初始化主题（App 启动时调用）
export function initTheme() {
  const state = useThemeStore.getState()
  const allThemes = [...builtinThemes, ...state.customThemes]
  applyTheme(state.currentThemeId, allThemes)
}
