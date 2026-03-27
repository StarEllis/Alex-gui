import { useState, useEffect, useCallback } from 'react'
import { familySocialApi } from '@/api'
import type { FamilyGroup, MediaShare, MediaRecommendation } from '@/types'
import { Users, Plus, Copy, UserPlus, Share2, Heart, Bell, Trash2, LogOut } from 'lucide-react'
import { useAuthStore } from '@/stores/auth'
import toast from 'react-hot-toast'
import { useTranslation } from '@/i18n'

export default function FamilyPage() {
  const { user } = useAuthStore()
  const { t } = useTranslation()
  const [groups, setGroups] = useState<FamilyGroup[]>([])
  const [selectedGroup, setSelectedGroup] = useState<FamilyGroup | null>(null)
  const [shares, setShares] = useState<MediaShare[]>([])
  const [recommendations, setRecommendations] = useState<MediaRecommendation[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showJoinDialog, setShowJoinDialog] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [activeTab, setActiveTab] = useState<'shares' | 'recommendations'>('shares')
  const [loading, setLoading] = useState(true)

  const fetchGroups = useCallback(async () => {
    try {
      const res = await familySocialApi.listGroups()
      setGroups(res.data.data || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await familySocialApi.getUnreadCount()
      setUnreadCount(res.data.count)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    fetchGroups()
    fetchUnreadCount()
  }, [fetchGroups, fetchUnreadCount])

  useEffect(() => {
    if (selectedGroup) {
      familySocialApi.listGroupShares(selectedGroup.id).then(res => {
        setShares(res.data.data || [])
      })
    }
  }, [selectedGroup])

  useEffect(() => {
    if (activeTab === 'recommendations') {
      familySocialApi.listRecommendations().then(res => {
        setRecommendations(res.data.data || [])
      })
    }
  }, [activeTab])

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return
    try {
      const res = await familySocialApi.createGroup(newGroupName)
      toast.success(t('family.createSuccess'))
      setGroups(prev => [...prev, res.data.data])
      setShowCreateDialog(false)
      setNewGroupName('')
    } catch (err: unknown) {
      toast.error(t('family.createFailed') + ': ' + ((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('common.error')))
    }
  }

  const handleJoinGroup = async () => {
    if (!inviteCode.trim()) return
    try {
      await familySocialApi.joinGroup(inviteCode)
      toast.success(t('family.joinSuccess'))
      fetchGroups()
      setShowJoinDialog(false)
      setInviteCode('')
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('family.joinFailed'))
    }
  }

  const handleCopyInviteCode = (code: string) => {
    navigator.clipboard.writeText(code)
    toast.success(t('family.inviteCodeCopied'))
  }

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm(t('family.deleteGroupConfirm'))) return
    try {
      await familySocialApi.deleteGroup(groupId)
      toast.success(t('family.deleteGroupSuccess'))
      setGroups(prev => prev.filter(g => g.id !== groupId))
      if (selectedGroup?.id === groupId) setSelectedGroup(null)
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('common.error'))
    }
  }

  const handleLeaveGroup = async (groupId: string) => {
    if (!confirm(t('family.leaveGroupConfirm'))) return
    try {
      await familySocialApi.leaveGroup(groupId)
      toast.success(t('family.leaveGroupSuccess'))
      setGroups(prev => prev.filter(g => g.id !== groupId))
      if (selectedGroup?.id === groupId) setSelectedGroup(null)
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || t('common.error'))
    }
  }

  const handleMarkRead = async (recId: string) => {
    try {
      await familySocialApi.markRecommendationRead(recId)
      setRecommendations(prev => prev.map(r => r.id === recId ? { ...r, is_read: true } : r))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="text-neon" size={28} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>家庭空间</h1>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs text-white">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreateDialog(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> 创建家庭组
          </button>
          <button onClick={() => setShowJoinDialog(true)} className="btn-secondary flex items-center gap-2">
            <UserPlus size={16} /> 加入家庭组
          </button>
        </div>
      </div>

      {/* 家庭组列表 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.map(group => (
          <div
            key={group.id}
            className={`glass-panel cursor-pointer rounded-xl p-4 transition-all hover:ring-2 hover:ring-neon/30 ${selectedGroup?.id === group.id ? 'ring-2 ring-neon' : ''}`}
            onClick={() => setSelectedGroup(group)}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{group.name}</h3>
              <div className="flex gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopyInviteCode(group.invite_code) }}
                  className="rounded p-1 hover:bg-neon/10" title="复制邀请码"
                >
                  <Copy size={14} className="text-neon" />
                </button>
                {group.owner_id === user?.id ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id) }}
                    className="rounded p-1 hover:bg-red-500/10" title="解散家庭组"
                  >
                    <Trash2 size={14} className="text-red-400" />
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleLeaveGroup(group.id) }}
                    className="rounded p-1 hover:bg-red-500/10" title="离开家庭组"
                  >
                    <LogOut size={14} className="text-red-400" />
                  </button>
                )}
              </div>
            </div>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {group.members?.length || 0} 位成员 · 邀请码: {group.invite_code}
            </p>
            {group.members && (
              <div className="mt-3 flex -space-x-2">
                {group.members.slice(0, 5).map(member => (
                  <div
                    key={member.id}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ring-2"
                    style={{
                      background: 'linear-gradient(135deg, var(--neon-blue), var(--neon-purple))',
                      color: 'var(--text-on-neon)',
                      boxShadow: '0 0 0 2px var(--bg-primary)',
                    }}
                    title={member.user?.username || member.nickname}
                  >
                    {(member.user?.username || member.nickname || '?').charAt(0).toUpperCase()}
                  </div>
                ))}
                {(group.members?.length || 0) > 5 && (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full text-xs ring-2"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', boxShadow: '0 0 0 2px var(--bg-primary)' }}>
                    +{(group.members?.length || 0) - 5}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {groups.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
            <Users size={48} className="mb-4 text-surface-400" />
            <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>还没有加入任何家庭组</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-tertiary)' }}>创建或加入一个家庭组，与家人分享精彩视频</p>
          </div>
        )}
      </div>

      {/* 选中家庭组的内容区 */}
      {selectedGroup && (
        <div className="glass-panel rounded-xl p-6">
          <div className="mb-4 flex items-center gap-4 border-b pb-4" style={{ borderColor: 'var(--border-default)' }}>
            <button
              onClick={() => setActiveTab('shares')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${activeTab === 'shares' ? 'bg-neon/10 text-neon' : ''}`}
              style={activeTab !== 'shares' ? { color: 'var(--text-secondary)' } : undefined}
            >
              <Share2 size={16} /> 分享动态
            </button>
            <button
              onClick={() => setActiveTab('recommendations')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${activeTab === 'recommendations' ? 'bg-neon/10 text-neon' : ''}`}
              style={activeTab !== 'recommendations' ? { color: 'var(--text-secondary)' } : undefined}
            >
              <Bell size={16} /> 推荐给我
              {unreadCount > 0 && (
                <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] text-white">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {activeTab === 'shares' && (
            <div className="space-y-4">
              {shares.length === 0 ? (
                <p className="py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>暂无分享动态</p>
              ) : (
                shares.map(share => (
                  <div key={share.id} className="flex items-start gap-3 rounded-lg p-3" style={{ background: 'var(--bg-secondary)' }}>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                      style={{ background: 'linear-gradient(135deg, var(--neon-blue), var(--neon-purple))', color: 'var(--text-on-neon)' }}>
                      {share.user?.username?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {share.user?.username} 分享了 {share.media?.title || share.series?.title || '内容'}
                      </p>
                      {share.message && <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{share.message}</p>}
                      <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {new Date(share.created_at).toLocaleString()}
                      </p>
                    </div>
                    <Heart size={16} className="cursor-pointer text-surface-400 hover:text-red-400" />
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'recommendations' && (
            <div className="space-y-4">
              {recommendations.length === 0 ? (
                <p className="py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>暂无推荐</p>
              ) : (
                recommendations.map(rec => (
                  <div key={rec.id} className={`flex items-start gap-3 rounded-lg p-3 ${!rec.is_read ? 'ring-1 ring-neon/30' : ''}`}
                    style={{ background: 'var(--bg-secondary)' }}>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                      style={{ background: 'linear-gradient(135deg, var(--neon-blue), var(--neon-purple))', color: 'var(--text-on-neon)' }}>
                      {rec.from_user?.username?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {rec.from_user?.username} 推荐了 {rec.media?.title || rec.series?.title || '内容'}
                      </p>
                      {rec.message && <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{rec.message}</p>}
                      <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {new Date(rec.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!rec.is_read && (
                      <button onClick={() => handleMarkRead(rec.id)} className="text-xs text-neon hover:underline">标记已读</button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* 创建家庭组对话框 */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreateDialog(false)}>
          <div className="glass-panel w-96 rounded-xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>创建家庭组</h3>
            <input
              type="text"
              placeholder="输入家庭组名称"
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              className="input-field mb-4 w-full"
              onKeyDown={e => e.key === 'Enter' && handleCreateGroup()}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreateDialog(false)} className="btn-secondary">取消</button>
              <button onClick={handleCreateGroup} className="btn-primary">创建</button>
            </div>
          </div>
        </div>
      )}

      {/* 加入家庭组对话框 */}
      {showJoinDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowJoinDialog(false)}>
          <div className="glass-panel w-96 rounded-xl p-6" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>加入家庭组</h3>
            <input
              type="text"
              placeholder="输入邀请码"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              className="input-field mb-4 w-full"
              onKeyDown={e => e.key === 'Enter' && handleJoinGroup()}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowJoinDialog(false)} className="btn-secondary">取消</button>
              <button onClick={handleJoinGroup} className="btn-primary">加入</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
