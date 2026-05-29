'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalSpent: 0,
    totalReceipts: 0,
    topCategory: null,
    recentReceipts: [],
  })

  useEffect(() => {
    const fetchStats = async () => {
      const supabase = createClient()
    
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }
    
      const { data: membership, error: membershipError } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single()
    
      if (!membership) {
        setLoading(false)
        return
      }
    
      const householdId = membership.household_id
    
      const { data: receipts, error: receiptsError } = await supabase
        .from('receipts')
        .select('id, store_id, total_amount, purchased_at, status, currency, stores(name)')
        .eq('household_id', householdId)
        .eq('status', 'confirmed')
        .order('purchased_at', { ascending: false })
    
      if (!receipts || receipts.length === 0) {
        setLoading(false)
        return
      }
    
      const totalSpent = receipts.reduce((sum, r) => sum + Number(r.total_amount), 0)
      const recentReceipts = receipts.slice(0, 5)
    
      setStats({
        totalSpent,
        totalReceipts: receipts.length,
        recentReceipts,
      })
    
      setLoading(false)
    }

    fetchStats()
  }, [])

  const formatCurrency = (amount, currency = 'EUR') => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: currency,
    }).format(amount)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading your dashboard...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-500 mt-1">Your grocery spending overview</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatCurrency(stats.totalSpent)}</p>
            <p className="text-xs text-gray-500 mt-1">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Receipts Scanned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalReceipts}</p>
            <p className="text-xs text-gray-500 mt-1">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatCurrency(
                stats.recentReceipts
                  .filter(r => new Date(r.purchased_at).getMonth() === new Date().getMonth())
                  .reduce((sum, r) => sum + Number(r.total_amount), 0)
              )}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {new Date().toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent receipts */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Receipts</h2>
        {stats.recentReceipts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-4xl mb-4">🧾</p>
              <p className="text-gray-500 font-medium">No receipts yet</p>
              <p className="text-gray-400 text-sm mt-1">
                Scan your first receipt to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {stats.recentReceipts.map((receipt) => (
              <Card key={receipt.id}>
                <CardContent className="py-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">🛒</span>
                    <div>
                      <p className="font-medium">
                        {receipt.stores?.name || 'Unknown store'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(receipt.purchased_at)}
                      </p>
                    </div>
                  </div>
                  <p className="font-semibold text-lg">
                    {formatCurrency(receipt.total_amount, receipt.currency || 'EUR')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
