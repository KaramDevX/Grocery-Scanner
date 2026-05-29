'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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

function ReceiptItemsSkeleton() {
  return (
    <div className="pt-4 space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-full bg-gray-100" />
          <div className="flex-1 space-y-1">
            <div className="h-3.5 bg-gray-100 rounded w-1/2" />
            <div className="h-3 bg-gray-100 rounded w-1/3" />
          </div>
          <div className="h-3.5 bg-gray-100 rounded w-16" />
        </div>
      ))}
    </div>
  )
}

function ReceiptItems({ receiptId, currency }) {
  const [items, setItems] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchItems = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('receipt_items')
        .select('product_name, brand_name, weight_volume, quantity, unit_price, total_price, categories(name, icon)')
        .eq('receipt_id', receiptId)

      if (error) {
        setError('Failed to load items')
      } else {
        setItems(data)
      }
      setLoading(false)
    }

    fetchItems()
  }, [receiptId])

  if (loading) return <ReceiptItemsSkeleton />

  if (error) {
    return (
      <div className="pt-4 text-sm text-red-500">{error}</div>
    )
  }

  if (!items || items.length === 0) {
    return (
      <div className="pt-4 text-sm text-gray-400">No items found for this receipt.</div>
    )
  }

  return (
    <div className="pt-4 border-t border-gray-100 space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-start gap-3">
          <span className="text-xl w-8 text-center leading-none mt-0.5">
            {item.categories?.icon || '🛍️'}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{item.product_name}</p>
            <p className="text-xs text-gray-400 truncate">
              {[
                item.brand_name,
                item.weight_volume,
                item.quantity > 1 ? `×${item.quantity}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <p className="text-sm font-medium text-gray-700 shrink-0">
            {formatCurrency(item.total_price, currency)}
          </p>
        </div>
      ))}
    </div>
  )
}

export default function ReceiptsPage() {
  const [loading, setLoading] = useState(true)
  const [receipts, setReceipts] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [itemCounts, setItemCounts] = useState({})

  useEffect(() => {
    const fetchReceipts = async () => {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data: membership } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single()

      if (!membership) {
        setLoading(false)
        return
      }

      const { data: receiptsData } = await supabase
        .from('receipts')
        .select('id, store_id, total_amount, purchased_at, currency, country, status, scanned_by, stores(name)')
        .eq('household_id', membership.household_id)
        .eq('status', 'confirmed')
        .order('purchased_at', { ascending: false })

      if (receiptsData && receiptsData.length > 0) {
        setReceipts(receiptsData)

        const counts = {}
        await Promise.all(
          receiptsData.map(async (receipt) => {
            const { count } = await supabase
              .from('receipt_items')
              .select('id', { count: 'exact', head: true })
              .eq('receipt_id', receipt.id)
            counts[receipt.id] = count || 0
          })
        )
        setItemCounts(counts)
      }

      setLoading(false)
    }

    fetchReceipts()
  }, [])

  const handleToggle = (id) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading receipts...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Receipts</h1>
        <p className="text-gray-500 mt-1">All your household grocery receipts</p>
      </div>

      {receipts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-5xl mb-4">🧾</p>
            <p className="text-gray-600 font-medium">No receipts yet.</p>
            <p className="text-gray-400 text-sm mt-1">
              Scan your first receipt to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {receipts.map((receipt) => {
            const isExpanded = expandedId === receipt.id
            const count = itemCounts[receipt.id]

            return (
              <Card
                key={receipt.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => handleToggle(receipt.id)}
              >
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-2xl">🛒</span>
                      <div>
                        <p className="font-medium text-gray-800">
                          {receipt.stores?.name || 'Unknown store'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(receipt.purchased_at)}
                          {count != null && (
                            <span className="ml-2 text-gray-400">
                              · {count} {count === 1 ? 'item' : 'items'}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-semibold text-lg">
                        {formatCurrency(receipt.total_amount, receipt.currency || 'EUR')}
                      </p>
                      <span className="text-gray-400 text-sm">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <ReceiptItems receiptId={receipt.id} currency={receipt.currency || 'EUR'} />
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
