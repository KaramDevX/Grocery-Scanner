import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request) {
  try {
    console.log('API key exists:', !!process.env.KIMI_API_KEY)
    console.log('API key prefix:', process.env.KIMI_API_KEY?.substring(0, 5))
    // Get the image data and household info from the request
    const { imageBase64, imageType, householdId, scannedBy } = await request.json()

    // Call Kimi K2.5 vision API
    const response = await fetch('https://api.moonshot.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.KIMI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'kimi-k2.5',
        messages: [
          {
            role: 'system',
            content: `You are a receipt scanning assistant. Extract all information from grocery receipts accurately. The receipt may be in any language including Hungarian, but you must always respond in English. Translate all product names, store names, and any other text to English. Always respond with valid JSON only, no markdown, no explanation.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${imageType};base64,${imageBase64}`
                }
              },
              {
                type: 'text',
                text: `Extract all information from this grocery receipt and return ONLY a JSON object with this exact structure, no other text. The receipt may be in Hungarian or any other language — translate everything to English including product names, store names, and categories:
      {
        "store_name": "store name here",
        "purchased_at": "YYYY-MM-DD HH:MM:SS",
        "total_amount": 0.00,
        "currency": "HUF",
        "country": "HU",
        "items": [
          {
            "product_name": "product name",
            "brand_name": "brand or null",
            "weight_volume": "500g or 2L or null",
            "unit_of_measurement": "g or ml or unit or null",
            "total_units": 500,
            "quantity": 1,
            "unit_price": 0.00,
            "total_price": 0.00,
            "price_per_unit": 0.00,
            "category": "one of: Dairy, Meat & Fish, Fruit & Vegetables, Bakery, Snacks, Frozen, Drinks, Pantry, Cleaning, Personal Care, Baby & Toddler, Pet Care, Other"
          }
        ]
      }`
              }
            ]
          }
        ],
        max_tokens: 8000,
        thinking: {
          type: 'disabled'
        }
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Kimi API error:', error)
      return Response.json({ error: 'AI processing failed' }, { status: 500 })
    }

    const aiResponse = await response.json()
    console.log('finish_reason:', aiResponse.choices[0].finish_reason)
    console.log('has reasoning:', !!aiResponse.choices[0].message.reasoning_content)
    console.log('Full AI response:', JSON.stringify(aiResponse.choices[0], null, 2))
    const content = aiResponse.choices[0].message.content
    console.log('AI response:', content)

    // Parse the JSON response from the AI
    let receiptData
    try {
      // Clean the response in case the AI adds any markdown
      const cleaned = content.replace(/```json|```/g, '').trim()
      receiptData = JSON.parse(cleaned)
    } catch (e) {
      console.error('Failed to parse AI response:', content)
      return Response.json({ error: 'Failed to parse receipt data' }, { status: 500 })
    }

    // Get category IDs from Supabase
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: categories } = await supabase
      .from('categories')
      .select('id, name')

    const categoryMap = {}
    categories?.forEach(cat => {
      categoryMap[cat.name] = cat.id
    })

    // Upsert the store
    const { data: store } = await supabase
      .from('stores')
      .upsert({
        name: receiptData.store_name,
        country: receiptData.country || 'IE'
      }, { onConflict: 'name,country' })
      .select()
      .single()

    // Create the receipt record
    const { data: receipt, error: receiptError } = await supabase
      .from('receipts')
      .insert({
        household_id: householdId,
        scanned_by: scannedBy,
        store_id: store?.id,
        purchased_at: receiptData.purchased_at,
        total_amount: receiptData.total_amount,
        currency: receiptData.currency || 'EUR',
        country: receiptData.country || 'IE',
        status: 'processed',
      })
      .select()
      .single()

    if (receiptError) {
      console.error('Receipt insert error:', receiptError)
      return Response.json({ error: 'Failed to save receipt' }, { status: 500 })
    }

    // Insert all receipt items
    const items = receiptData.items.map(item => ({
      receipt_id: receipt.id,
      category_id: categoryMap[item.category] || categoryMap['Other'],
      product_name: item.product_name,
      brand_name: item.brand_name || null,
      weight_volume: item.weight_volume || null,
      unit_of_measurement: item.unit_of_measurement || null,
      total_units: item.total_units || null,
      quantity: item.quantity || 1,
      unit_price: item.unit_price,
      total_price: item.total_price,
      price_per_unit: item.price_per_unit || null,
    }))

    const { error: itemsError } = await supabase
      .from('receipt_items')
      .insert(items)

    if (itemsError) {
      console.error('Items insert error:', itemsError)
      return Response.json({ error: 'Failed to save receipt items' }, { status: 500 })
    }

    return Response.json({
      success: true,
      receiptId: receipt.id,
      storeName: receiptData.store_name,
      totalAmount: receiptData.total_amount,
      currency: receiptData.currency || 'EUR',
      itemCount: receiptData.items.length,
    })

  } catch (error) {
    console.error('Scan error:', error)
    return Response.json({ error: 'Something went wrong' }, { status: 500 })
  }
}