'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [user, setUser] = useState(null)
  const [profileName, setProfileName] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  const [household, setHousehold] = useState(null)
  const [membership, setMembership] = useState(null)
  const [householdName, setHouseholdName] = useState('')
  const [householdSaving, setHouseholdSaving] = useState(false)
  const [householdSaved, setHouseholdSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const [members, setMembers] = useState([])
  const [removingId, setRemovingId] = useState(null)

  useEffect(() => {
    const fetchAll = async () => {
      const supabase = createClient()

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single()

      if (profileError) { setError('Failed to load profile'); setLoading(false); return }
      setProfileName(profile?.full_name || '')

      const { data: membershipData, error: membershipError } = await supabase
        .from('household_members')
        .select('id, household_id, role, joined_at')
        .eq('user_id', user.id)
        .single()

      if (membershipError) { setError('Failed to load household'); setLoading(false); return }
      setMembership(membershipData)

      const { data: householdData, error: householdError } = await supabase
        .from('households')
        .select('id, name, type, invite_code')
        .eq('id', membershipData.household_id)
        .single()

      if (householdError) { setError('Failed to load household'); setLoading(false); return }
      setHousehold(householdData)
      setHouseholdName(householdData?.name || '')

      if (householdData?.type === 'household') {
        const { data: membersData } = await supabase
          .from('household_members')
          .select('id, user_id, role, joined_at')
          .eq('household_id', membershipData.household_id)

        if (membersData && membersData.length > 0) {
          const userIds = membersData.map((m) => m.user_id)
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds)

          setMembers(
            membersData.map((m) => ({
              ...m,
              full_name: profilesData?.find((p) => p.id === m.user_id)?.full_name || 'Unknown',
            }))
          )
        }
      }

      setLoading(false)
    }

    fetchAll()
  }, [])

  const saveProfile = async () => {
    if (!profileName.trim() || !user) return
    setProfileSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: profileName.trim() })
      .eq('id', user.id)

    setProfileSaving(false)
    if (!error) {
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 3000)
    }
  }

  const saveHousehold = async () => {
    if (!householdName.trim() || !household) return
    setHouseholdSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('households')
      .update({ name: householdName.trim() })
      .eq('id', household.id)

    setHouseholdSaving(false)
    if (!error) {
      setHousehold((prev) => ({ ...prev, name: householdName.trim() }))
      setHouseholdSaved(true)
      setTimeout(() => setHouseholdSaved(false), 3000)
    }
  }

  const copyInviteCode = () => {
    if (!household?.invite_code) return
    navigator.clipboard.writeText(household.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const removeMember = async (memberId) => {
    if (!memberId) return
    setRemovingId(memberId)
    const supabase = createClient()
    await supabase.from('household_members').delete().eq('id', memberId)
    setMembers((prev) => prev.filter((m) => m.id !== memberId))
    setRemovingId(null)
  }

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading settings...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500">{error}</p>
      </div>
    )
  }

  const isAdmin = membership?.role === 'admin'

  return (
    <div className="space-y-8 max-w-2xl">

      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your profile and household</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email || ''} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="full-name">Full name</Label>
            <Input
              id="full-name"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={saveProfile} disabled={profileSaving}>
              {profileSaving ? 'Saving…' : 'Save changes'}
            </Button>
            {profileSaved && (
              <span className="text-sm text-green-600">Profile updated</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Household */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Household</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Type</span>
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700 capitalize">
              {household?.type}
            </span>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="household-name">Household name</Label>
            <Input
              id="household-name"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              placeholder="Household name"
              disabled={!isAdmin}
            />
            {!isAdmin && (
              <p className="text-xs text-gray-400">Only admins can change the household name.</p>
            )}
          </div>

          {isAdmin && (
            <div className="flex items-center gap-3">
              <Button onClick={saveHousehold} disabled={householdSaving}>
                {householdSaving ? 'Saving…' : 'Save changes'}
              </Button>
              {householdSaved && (
                <span className="text-sm text-green-600">Household updated</span>
              )}
            </div>
          )}

          {household?.type === 'household' && household?.invite_code && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label>Invite code</Label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-2.5">
                    <span className="font-mono text-lg font-semibold tracking-widest text-gray-800">
                      {household.invite_code}
                    </span>
                  </div>
                  <Button variant="outline" onClick={copyInviteCode} className="shrink-0">
                    {copied ? 'Copied!' : 'Copy code'}
                  </Button>
                </div>
                <p className="text-xs text-gray-400">
                  Share this code so others can join your household.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Members — only for household type */}
      {household?.type === 'household' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Members
              <span className="ml-2 text-sm font-normal text-gray-400">
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="text-sm text-gray-400">No members found.</p>
            ) : (
              <div className="space-y-1">
                {members.map((member, idx) => {
                  const isSelf = member.user_id === user?.id
                  return (
                    <div key={member.id}>
                      {idx > 0 && <Separator className="my-1" />}
                      <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
                            {member.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {member.full_name}
                              {isSelf && (
                                <span className="ml-1.5 text-xs text-gray-400">(you)</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400">
                              Joined {formatDate(member.joined_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              member.role === 'admin'
                                ? 'bg-black text-white'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {member.role === 'admin' ? 'Admin' : 'Member'}
                          </span>
                          {isAdmin && !isSelf && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeMember(member.id)}
                              disabled={removingId === member.id}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                              {removingId === member.id ? 'Removing…' : 'Remove'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Danger zone */}
      <Card className="border-red-100">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-red-600">Danger zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">Sign out</p>
              <p className="text-xs text-gray-400">You will be redirected to the login page.</p>
            </div>
            <Button variant="destructive" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}
