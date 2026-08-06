// GeniusPay API Client for MYCHURCH
// Docs: https://geniuspay.ci/docs/api
import { createHmac, timingSafeEqual } from 'node:crypto'

const GENIUSPAY_BASE_URL = process.env.GENIUSPAY_BASE_URL || 'https://geniuspay.ci/api/v1/merchant'
const GENIUSPAY_API_KEY = process.env.GENIUSPAY_API_KEY || ''
const GENIUSPAY_API_SECRET = process.env.GENIUSPAY_API_SECRET || ''

interface GeniusPayHeaders {
  'X-API-Key': string
  'X-API-Secret': string
  'Content-Type': string
  [key: string]: string
}

function getHeaders(): GeniusPayHeaders {
  return {
    'X-API-Key': GENIUSPAY_API_KEY,
    'X-API-Secret': GENIUSPAY_API_SECRET,
    'Content-Type': 'application/json',
  }
}

export interface GeniusPayCustomer {
  name?: string
  email?: string
  phone?: string
  country?: string
}

export interface GeniusPayPaymentCreate {
  amount: number
  currency?: string // XOF, EUR, USD (default: XOF)
  payment_method?: string // wave, pawapay, paystack, orange_money, mtn_money, card
  gateway?: string
  mmo_provider?: string
  description?: string
  customer?: GeniusPayCustomer
  success_url?: string
  error_url?: string
  callback_url?: string
  metadata?: Record<string, string | number>
}

export interface GeniusPayPaymentResponse {
  success: boolean
  data: {
    id: number
    reference: string
    amount: number
    currency: string
    fees: number
    net_amount: number
    status: string // pending, processing, completed, failed, expired
    payment_method: string | null
    payment_url?: string
    checkout_url?: string
    gateway: string
    environment: string
    metadata?: Record<string, string | number>
    customer?: {
      name: string
      email: string
      phone: string
    }
    created_at: string
    completed_at?: string
    expires_at?: string
  }
  error?: {
    code: string
    message: string
  }
}

export interface GeniusPayPaymentListResponse {
  success: boolean
  data: GeniusPayPaymentResponse['data'][]
  meta: {
    current_page: number
    per_page: number
    total: number
    last_page: number
  }
}

export interface GeniusPayBalanceResponse {
  success: boolean
  data: {
    available: number
    pending: number
    total: number
    currency: string
  }
}

export interface GeniusPayProvider {
  code: string
  name: string
  type: string
}

export interface GeniusPayProvidersResponse {
  success: boolean
  data: {
    country: string
    country_iso3: string
    country_name: string
    currency: string
    providers: GeniusPayProvider[]
  } | {
    countries: Array<{
      country: string
      country_iso3: string
      country_name: string
      currency: string
      providers: GeniusPayProvider[]
    }>
    total_countries: number
  }
}

export interface GeniusPayWebhookPayload {
  id: string
  event: string
  timestamp: number
  created_at: string
  data: {
    object: string
    id: number
    reference: string
    amount: number
    currency: string
    fees: number
    net_amount: number
    status: string
    payment_method: string
    provider: string
    customer_name: string
    customer_phone: string
    merchant_id: number
    metadata: Record<string, string>
  }
  environment: string
  api_version: string
}

// Create a payment (returns checkout URL if no payment_method specified)
export async function createPayment(params: GeniusPayPaymentCreate): Promise<GeniusPayPaymentResponse> {
  const response = await fetch(`${GENIUSPAY_BASE_URL}/payments`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData?.error?.message || `GeniusPay API error: ${response.status}`)
  }

  return response.json()
}

// Get a payment by reference
export async function getPayment(reference: string): Promise<GeniusPayPaymentResponse> {
  const response = await fetch(`${GENIUSPAY_BASE_URL}/payments/${reference}`, {
    method: 'GET',
    headers: getHeaders(),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData?.error?.message || `GeniusPay API error: ${response.status}`)
  }

  return response.json()
}

// List payments with optional filters
export async function listPayments(params?: {
  status?: string
  payment_method?: string
  from?: string
  to?: string
  search?: string
  per_page?: number
}): Promise<GeniusPayPaymentListResponse> {
  const searchParams = new URLSearchParams()
  if (params?.status) searchParams.set('status', params.status)
  if (params?.payment_method) searchParams.set('payment_method', params.payment_method)
  if (params?.from) searchParams.set('from', params.from)
  if (params?.to) searchParams.set('to', params.to)
  if (params?.search) searchParams.set('search', params.search)
  if (params?.per_page) searchParams.set('per_page', String(params.per_page))

  const response = await fetch(`${GENIUSPAY_BASE_URL}/payments?${searchParams.toString()}`, {
    method: 'GET',
    headers: getHeaders(),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData?.error?.message || `GeniusPay API error: ${response.status}`)
  }

  return response.json()
}

// Get account balance
export async function getBalance(): Promise<GeniusPayBalanceResponse> {
  const response = await fetch(`${GENIUSPAY_BASE_URL}/account/balance`, {
    method: 'GET',
    headers: getHeaders(),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData?.error?.message || `GeniusPay API error: ${response.status}`)
  }

  return response.json()
}

// Get MMO providers by country
export async function getProviders(country?: string): Promise<GeniusPayProvidersResponse> {
  const url = country
    ? `${GENIUSPAY_BASE_URL}/pawapay/providers?country=${country}`
    : `${GENIUSPAY_BASE_URL}/pawapay/providers`

  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData?.error?.message || `GeniusPay API error: ${response.status}`)
  }

  return response.json()
}

// Verify webhook signature
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string,
  secret: string
): boolean {
  const expectedSignature = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex')
  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  } catch {
    return false
  }
}

// Convert USD to XOF (approximate rate: 1 USD = 600 XOF)
export function usdToXof(usd: number): number {
  return Math.round(usd * 600)
}

// Get the public key for client-side (safe to expose)
export function getPublicKey(): string {
  return process.env.NEXT_PUBLIC_GENIUSPAY_PUBLIC_KEY || ''
}