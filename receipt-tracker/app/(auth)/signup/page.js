'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [step, setStep] = useState(1) // step 1: details, step 2: household choice
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    householdType: '',
    householdName: '',
  })

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleNextStep = (e) => {
    e.preventDefault()
    if (!formData.fullName || !formData.email || !formData.password) {
      setError('Please fill in all fields')
      return
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    setError(null)
    setStep(2)
  }

  const handleSignup = async (householdType) => {
    setLoading(true)
    setError(null)

    const householdName = householdType === 'solo'
      ? 'My Finances'
      : formData.householdName || 'My Household'

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.fullName,
          household_type: householdType,
          household_name: householdName,
        }
      }
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/onboarding')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <CardDescription>
          {step === 1
            ? 'Enter your details to get started'
            : 'How will you be using the app?'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* STEP 1 — Personal details */}
        {step === 1 && (
          <form onSubmit={handleNextStep} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                name="fullName"
                placeholder="Sarah Johnson"
                value={formData.fullName}
                onChange={handleChange}
                autoComplete="name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={formData.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="At least 6 characters"
                value={formData.password}
                onChange={handleChange}
                autoComplete="new-password"
                required
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
        )}

        {/* STEP 2 — Household choice */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Solo option */}
            <button
              onClick={() => handleSignup('solo')}
              disabled={loading}
              className="w-full text-left p-4 rounded-lg border-2 border-gray-200 hover:border-black transition-colors"
            >
              <div className="font-semibold text-lg">Just me 🧑</div>
              <div className="text-sm text-gray-500 mt-1">
                Track your own grocery spending personally
              </div>
            </button>

            {/* Household option */}
            <button
              onClick={() => setFormData({ ...formData, householdType: 'household' })}
              disabled={loading}
              className="w-full text-left p-4 rounded-lg border-2 border-gray-200 hover:border-black transition-colors"
            >
              <div className="font-semibold text-lg">A household 🏠</div>
              <div className="text-sm text-gray-500 mt-1">
                Share spending tracking with family or flatmates
              </div>
            </button>

            {/* Household name input — shows when household is selected */}
            {formData.householdType === 'household' && (
              <div className="space-y-2 pt-2">
                <Label htmlFor="householdName">Household name</Label>
                <Input
                  id="householdName"
                  name="householdName"
                  placeholder="The Johnsons"
                  value={formData.householdName}
                  onChange={handleChange}
                />
                <Button
                  onClick={() => handleSignup('household')}
                  disabled={loading || !formData.householdName}
                  className="w-full mt-2"
                >
                  {loading ? 'Creating account...' : 'Create account'}
                </Button>
              </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              onClick={() => setStep(1)}
              className="text-sm text-gray-500 hover:text-black w-full text-center"
            >
              ← Back
            </button>
          </div>
        )}
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="text-black font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}