'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function ScanPage() {
  const router = useRouter()
  const fileInputRef = useRef(null)
  const [image, setImage] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const handleImageSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return

    setImageFile(file)
    setError(null)
    setResult(null)

    // Show preview
    const reader = new FileReader()
    reader.onload = (e) => setImage(e.target.result)
    reader.readAsDataURL(file)
  }

  const handleScan = async () => {
    if (!imageFile) return
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Get user and household
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: membership } = await supabase
        .from('household_members')
        .select('household_id')
        .eq('user_id', user.id)
        .single()

      if (!membership) {
        setError('Could not find your household')
        setLoading(false)
        return
      }

      // Convert image to base64
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const base64String = e.target.result.split(',')[1]
          resolve(base64String)
        }
        reader.readAsDataURL(imageFile)
      })

      // Upload image to Supabase Storage
      const fileName = `${user.id}/${Date.now()}.${imageFile.name.split('.').pop()}`
      await supabase.storage
        .from('receipts')
        .upload(fileName, imageFile)

      // Call our API route
      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          imageType: imageFile.type,
          householdId: membership.household_id,
          scannedBy: user.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Something went wrong')
        setLoading(false)
        return
      }

      setResult(data)

    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
    }

    setLoading(false)
  }

  const handleConfirm = async () => {
    if (!result) return
    setLoading(true)

    const supabase = createClient()
    await supabase
      .from('receipts')
      .update({ status: 'confirmed' })
      .eq('id', result.receiptId)

    router.push('/dashboard')
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Scan Receipt</h1>
        <p className="text-gray-500 mt-1">Upload a photo of your grocery receipt</p>
      </div>

      {/* Upload area */}
      {!result && (
        <Card
          className="border-2 border-dashed border-gray-300 hover:border-black transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <CardContent className="py-12 text-center">
            {image ? (
              <img
                src={image}
                alt="Receipt preview"
                className="max-h-96 mx-auto rounded-lg object-contain"
              />
            ) : (
              <div>
                <p className="text-5xl mb-4">📷</p>
                <p className="font-medium text-gray-700">Click to upload a receipt</p>
                <p className="text-sm text-gray-500 mt-1">JPG, PNG or HEIC</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}

      {/* Scan button */}
      {image && !result && (
        <div className="flex gap-3">
          <Button
            onClick={handleScan}
            disabled={loading}
            className="flex-1"
          >
            {loading ? 'Reading receipt...' : 'Scan Receipt'}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setImage(null)
              setImageFile(null)
            }}
            disabled={loading}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          <Card className="border-green-200 bg-green-50">
            <CardContent className="py-6">
              <p className="text-green-700 font-semibold text-lg">
                ✅ Receipt scanned successfully
              </p>
              <div className="mt-3 space-y-1 text-sm text-green-600">
                <p>Store: <span className="font-medium">{result.storeName}</span></p>
                <p>Total: <span className="font-medium">{result.totalAmount} {result.currency}</span></p>
                <p>Items found: <span className="font-medium">{result.itemCount}</span></p>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button onClick={handleConfirm} disabled={loading} className="flex-1">
              {loading ? 'Saving...' : 'Confirm and Save'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setResult(null)
                setImage(null)
                setImageFile(null)
              }}
            >
              Scan Another
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}