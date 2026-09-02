'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAppStore } from '@/store/app-store'
import { useSupabaseRealtime } from '@/hooks/use-supabase-realtime'
import { CREATOR, REVENUE_LABELS, EXPENSE_LABELS, CURRENCY_LABELS, type RevenueCategory, type ExpenseCategory, type Currency, type TransactionLocation } from '@/lib/constants'
import { normalizeCurrencyCode, currencySymbol } from '@/lib/currency'
import { authFetch } from '@/lib/auth-fetch'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, TrendingUp, TrendingDown, DollarSign, Wallet, Building2, Banknote, Edit, Trash2, ArrowUpRight, ArrowDownRight, Wallet as WalletIcon, PieChart as PieChartIcon, BarChart3, Download, FileText, Printer } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts'
import { EmptyState } from '@/components/mychurch/shared/empty-state'
import { downloadCSV } from '@/lib/csv-utils'
import { canCreateFinances, canEditFinances, canDeleteFinances } from '@/lib/frontend-rbac'
import { generateFinancialPDF } from '@/lib/financial-pdf'
import { SignaturePad } from '@/components/ui/signature-pad'

interface Transaction {
  id: string
  type: string
  category: string
  amount: number
  currency: string
  location: string
  description: string | null
  date: string
  memberId: string | null
  recordedByName?: string | null
  beneficiary?: string | null
  referenceNumber?: string | null
  signatureData?: string | null
}

export function FinancesPage() {
  const { auth } = useAppStore()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [currencyFilter, setCurrencyFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totals, setTotals] = useState({ revenue: 0, expense: 0, balance: 0 })
  const [currencies, setCurrencies] = useState<Record<string, { initialCapital: number; revenue: number; expense: number; balance: number }>>(
    { USD: { initialCapital: 0, revenue: 0, expense: 0, balance: 0 }, EUR: { initialCapital: 0, revenue: 0, expense: 0, balance: 0 }, CDF: { initialCapital: 0, revenue: 0, expense: 0, balance: 0 } }
  )
  const [nextRefNumber, setNextRefNumber] = useState('REF-000001')
  const [churchCurrency, setChurchCurrency] = useState('USD')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [members, setMembers] = useState<{ id: string; firstName: string; lastName: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [chartDataLoading, setChartDataLoading] = useState(true)
  const fetchingRef = useRef(false)
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([])
  const [exporting, setExporting] = useState(false)

  const [form, setForm] = useState({
    type: 'revenue' as 'revenue' | 'expense',
    category: '' as string,
    amount: '',
    currency: 'USD' as Currency,
    location: 'cash' as TransactionLocation,
    description: '',
    date: new Date().toISOString().split('T')[0],
    memberId: '',
    recordedByName: '',
    beneficiary: '',
    referenceNumber: '',
    signatureData: null as string | null,
  })

  const fetchData = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(typeFilter !== 'all' && { type: typeFilter }),
        ...(currencyFilter !== 'all' && { currency: currencyFilter }),
        ...(locationFilter !== 'all' && { location: locationFilter }),
      })
      const [res, mRes] = await Promise.all([
        authFetch(`/api/finances?${params}`),
        authFetch('/api/members?limit=100'),
      ])
      if (res.ok) {
        const data = await res.json()
        setTransactions(data.transactions || data.data || [])
        setTotal(data.pagination?.total ?? 0)
        setTotals({
          revenue: data.totals?.revenue || 0,
          expense: data.totals?.expense || 0,
          balance: data.totals?.balance || 0,
        })
        if (data.currencies) setCurrencies(data.currencies)
        if (data.churchCurrency) setChurchCurrency(data.churchCurrency)
        if (data.nextReferenceNumberFormatted) setNextRefNumber(data.nextReferenceNumberFormatted)
      } else {
        console.error('Finances fetch failed:', res.status)
      }
      if (mRes.ok) {
        const mData = await mRes.json()
        setMembers(mData.members || mData.data || [])
      } else {
        console.error('Members fetch failed:', mRes.status)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [page, typeFilter, currencyFilter, locationFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // Realtime : rafraîchit les finances dès qu'une transaction change (en + du polling)
  useSupabaseRealtime(['transaction'], () => fetchData(), auth.churchId)

  // Fetch all transactions for chart data
  const fetchChartData = useCallback(async () => {
    setChartDataLoading(true)
    try {
      const res = await authFetch('/api/finances?limit=200')
      if (res.ok) {
        const data = await res.json()
        setAllTransactions(data.transactions || data.data || [])
      }
    } catch {
      console.error('Erreur lors du chargement des données du graphique')
    } finally {
      setChartDataLoading(false)
    }
  }, [])

  useEffect(() => { fetchChartData() }, [fetchChartData])

  const categories = form.type === 'revenue' ? REVENUE_LABELS : EXPENSE_LABELS
  const filteredTransactions = tab === 'all' ? transactions : transactions.filter((t) => t.type === tab)

  const handleSubmit = async () => {
    if (!form.category || !form.amount || !form.date) {
      toast.error('Catégorie, montant et date sont obligatoires')
      return
    }
    setSubmitting(true)
    try {
      const url = editing ? `/api/finances?id=${editing.id}` : '/api/finances'
      const res = await authFetch(url, {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...form,
          amount: parseFloat(form.amount),
          memberId: form.memberId || null,
          recordedByName: form.recordedByName || null,
          beneficiary: form.beneficiary || null,
          referenceNumber: form.referenceNumber || null,
          signatureData: form.signatureData || null,
        }),
      })
      if (res.ok) {
        toast.success(editing ? 'Transaction modifiée' : 'Transaction ajoutée')
        setDialogOpen(false)
        setEditing(null)
        setForm({
          type: 'revenue', category: '', amount: '', currency: 'USD',
          location: 'cash', description: '', date: new Date().toISOString().split('T')[0], memberId: '',
          recordedByName: '', beneficiary: '', referenceNumber: '', signatureData: null,
        })
        fetchData()
      } else {
        const err = await res.json()
        toast.error(err.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await authFetch(`/api/finances?id=${id}`, { method: 'DELETE' })
      if (res.ok) { toast.success('Transaction supprimée'); fetchData() }
    } catch { toast.error('Erreur') }
  }

  const openCreate = (type: 'revenue' | 'expense') => {
    setEditing(null)
    const userFullName = [auth.firstName, auth.lastName].filter(Boolean).join(' ')
    setForm({
      type, category: '', amount: '', currency: 'USD',
      location: 'cash', description: '', date: new Date().toISOString().split('T')[0], memberId: '',
      recordedByName: userFullName,
      beneficiary: '',
      referenceNumber: nextRefNumber,
      signatureData: null,
    })
    setDialogOpen(true)
  }

  const openEdit = (t: Transaction) => {
    setEditing(t)
    setForm({
      type: t.type as 'revenue' | 'expense',
      category: t.category,
      amount: String(t.amount),
      currency: t.currency as Currency,
      location: t.location as TransactionLocation,
      description: t.description || '',
      date: t.date.split('T')[0],
      memberId: t.memberId || '',
      recordedByName: t.recordedByName || [auth.firstName, auth.lastName].filter(Boolean).join(' '),
      beneficiary: t.beneficiary || '',
      referenceNumber: t.referenceNumber || '',
      signatureData: t.signatureData || null,
    })
    setDialogOpen(true)
  }

  // Monthly trend data (last 6 months)
  const monthlyTrendData = (() => {
    const now = new Date()
    const months: { key: string; label: string; "Compte rendus": number; Dépenses: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
      months.push({ key, label, "Compte rendus": 0, Dépenses: 0 })
    }
    allTransactions.forEach((t) => {
      const tDate = new Date(t.date)
      const tKey = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}`
      const month = months.find((m) => m.key === tKey)
      if (month) {
        if (t.type === 'revenue') month["Compte rendus"] += t.amount
        else month.Dépenses += t.amount
      }
    })
    return months
  })()

  // Expense category breakdown for pie chart
  const PIE_COLORS = [
    'var(--color-violet-500)',
    'var(--color-emerald-500)',
    'var(--color-amber-500)',
    'var(--color-rose-500)',
    'var(--color-cyan-500)',
  ]

  const expenseCategoryData = (() => {
    const expenseTxs = allTransactions.filter((t) => t.type === 'expense')
    const categoryMap: Record<string, number> = {}
    expenseTxs.forEach((t) => {
      categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount
    })
    const sorted = Object.entries(categoryMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    return sorted.map(([cat, amount]) => ({
      name: EXPENSE_LABELS[cat as ExpenseCategory] || cat,
      value: Math.round(amount * 100) / 100,
    }))
  })()

  const totalExpensesPie = expenseCategoryData.reduce((s, d) => s + d.value, 0)

  // Revenue category breakdown for pie chart (Analyse financière)
  const REVENUE_PIE_COLORS = [
    'var(--color-teal-500)',
    'var(--color-emerald-500)',
    'var(--color-amber-500)',
    'var(--color-orange-500)',
    'var(--color-rose-400)',
  ]

  const revenueCategoryData = (() => {
    const revenueTxs = allTransactions.filter((t) => t.type === 'revenue')
    const categoryMap: Record<string, number> = {}
    revenueTxs.forEach((t) => {
      categoryMap[t.category] = (categoryMap[t.category] || 0) + t.amount
    })
    const sorted = Object.entries(categoryMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    return sorted.map(([cat, amount]) => ({
      name: REVENUE_LABELS[cat as RevenueCategory] || cat,
      value: Math.round(amount * 100) / 100,
    }))
  })()

  const totalRevenuePie = revenueCategoryData.reduce((s, d) => s + d.value, 0)

  // Sparkline data (last 7 transactions grouped by day)
  const sparklineRevenue = (() => {
    const rev = allTransactions.filter((t) => t.type === 'revenue').slice(-7)
    return rev.map((t, i) => ({ v: t.amount }))
  })()

  const sparklineExpense = (() => {
    const exp = allTransactions.filter((t) => t.type === 'expense').slice(-7)
    return exp.map((t, i) => ({ v: t.amount }))
  })()

  const sparklineBalance = (() => {
    const recent = allTransactions.slice(-7)
    let running = 0
    return recent.map((t) => {
      running += t.type === 'revenue' ? t.amount : -t.amount
      return { v: running }
    })
  })()

  // Bar chart data
  const chartData = [
    { name: 'Compte rendus', value: totals.revenue, fill: 'var(--color-emerald-500)' },
    { name: 'Dépenses', value: totals.expense, fill: 'var(--color-red-500)' },
  ]

  const handleExportCSV = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams({ limit: '999' })
      const res = await authFetch(`/api/finances?${params}`)
      if (!res.ok) {
        toast.error('Erreur lors de l\'export')
        return
      }
      const data = await res.json()
      const all: Transaction[] = data.transactions || data.data || []

      const locationLabel = (loc: string) => (loc === 'bank' ? 'Banque' : 'Espèces')
      const today = new Date().toISOString().slice(0, 10)
      downloadCSV(
        all.map((t) => ({
          date: new Date(t.date).toLocaleDateString('fr-FR'),
          type: t.type === 'revenue' ? 'Compte rendu' : 'Dépense',
          category:
            t.type === 'revenue'
              ? (REVENUE_LABELS[t.category as RevenueCategory] ?? t.category)
              : (EXPENSE_LABELS[t.category as ExpenseCategory] ?? t.category),
          amount: t.amount.toFixed(2),
          currency: t.currency,
          location: locationLabel(t.location),
          description: t.description || '',
        })),
        `finances_export_${today}.csv`,
        [
          { key: 'date', label: 'Date' },
          { key: 'type', label: 'Type' },
          { key: 'category', label: 'Catégorie' },
          { key: 'amount', label: 'Montant' },
          { key: 'currency', label: 'Devise' },
          { key: 'location', label: 'Lieu' },
          { key: 'description', label: 'Description' },
        ],
      )
      toast.success(`${all.length} transaction(s) exportée(s)`)
    } catch {
      toast.error('Erreur lors de l\'export')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Gradient Header Bar */}
      <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-primary to-primary/60 p-5 text-primary-foreground shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Gestion Financière</h1>
            <p className="text-xs text-primary-foreground/80">{CREATOR}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV} disabled={exporting} className="gap-2 border-white/40 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
            <Download className="h-4 w-4" /> {exporting ? 'Export...' : 'Exporter CSV'}
          </Button>
          <Button onClick={() => openCreate('revenue')} className="gap-2 bg-white text-primary hover:bg-white/90">
            <ArrowUpRight className="h-4 w-4" /> Compte rendu
          </Button>
          <Button variant="outline" onClick={() => openCreate('expense')} className="gap-2 border-white/40 text-primary-foreground hover:bg-white/10 hover:text-primary-foreground">
            <ArrowDownRight className="h-4 w-4" /> Dépense
          </Button>
        </div>
      </div>

      {/* Multi-Currency Caisse Physique Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { currency: 'USD', symbol: '$', color: 'emerald', icon: '🇺🇸' },
          { currency: 'EUR', symbol: '€', color: 'blue', icon: '🇪🇺' },
          { currency: 'CDF', symbol: 'FC', color: 'amber', icon: '🇨🇩' },
        ].map(({ currency, symbol, color, icon }) => {
          const c = currencies[currency] || { initialCapital: 0, revenue: 0, expense: 0, balance: 0 }
          const isNegative = c.balance < 0
          return (
            <Card key={currency} className={`border-l-4 hover:shadow-lg transition-all duration-200 overflow-hidden relative ${
              color === 'emerald' ? 'border-l-emerald-500' : color === 'blue' ? 'border-l-blue-500' : 'border-l-amber-500'
            }`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${
                      color === 'emerald' ? 'bg-emerald-500/10' : color === 'blue' ? 'bg-blue-500/10' : 'bg-amber-500/10'
                    }`}>
                      <Banknote className={`h-5 w-5 ${
                        color === 'emerald' ? 'text-emerald-500' : color === 'blue' ? 'text-blue-500' : 'text-amber-500'
                      }`} />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Caisse {currency}</p>
                      <p className={`text-xl font-bold tabular-nums ${
                        isNegative ? 'text-rose-500' : color === 'emerald' ? 'text-emerald-600' : color === 'blue' ? 'text-blue-600' : 'text-amber-600'
                      }`}>
                        {c.balance.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {symbol}
                      </p>
                    </div>
                  </div>
                  <span className="text-lg">{icon}</span>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Capital initial</span>
                    <span className="font-medium text-foreground tabular-nums">{c.initialCapital.toLocaleString('fr-FR')} {symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-emerald-600">+ Recettes</span>
                    <span className="font-medium text-emerald-600 tabular-nums">+{c.revenue.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-rose-500">− Dépenses</span>
                    <span className="font-medium text-rose-500 tabular-nums">−{c.expense.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {symbol}</span>
                  </div>
                  <div className={`flex justify-between pt-1.5 mt-1 border-t font-semibold ${isNegative ? 'text-rose-500' : 'text-foreground'}`}>
                    <span>Solde disponible</span>
                    <span className="tabular-nums">{c.balance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {symbol}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Analyse financière — Charts Section (top) */}
      {!chartDataLoading && allTransactions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-teal-500" />
              Analyse financière
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Revenue vs Expense BarChart */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Compte rendus vs Dépenses (6 derniers mois)</h3>
                <div className="h-64">
                  {monthlyTrendData.every((m) => m["Compte rendus"] === 0 && m.Dépenses === 0) ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                      Données insuffisantes
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyTrendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '13px',
                          }}
                          formatter={(value: number) => [`${value.toFixed(2)} USD`, '']}
                        />
                        <Legend />
                        <Bar dataKey="Compte rendus" fill="var(--color-emerald-500)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Dépenses" fill="var(--color-rose-500)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Revenue Category Breakdown PieChart */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Répartition des compte rendus par catégorie</h3>
                <div className="h-64">
                  {revenueCategoryData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                      Données insuffisantes
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 h-full">
                      <div className="h-full w-1/2 min-w-[140px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={revenueCategoryData}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={80}
                              paddingAngle={3}
                              dataKey="value"
                              strokeWidth={0}
                            >
                              {revenueCategoryData.map((_, index) => (
                                <Cell key={`rev-cell-${index}`} fill={REVENUE_PIE_COLORS[index % REVENUE_PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--card))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '8px',
                                fontSize: '13px',
                              }}
                              formatter={(value: number) => [`${value.toFixed(2)} USD`, '']}
                            />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex-1 space-y-2 min-w-0">
                        {revenueCategoryData.map((entry, index) => (
                          <div key={entry.name} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div
                                className="h-3 w-3 rounded-full shrink-0"
                                style={{ backgroundColor: REVENUE_PIE_COLORS[index % REVENUE_PIE_COLORS.length] }}
                              />
                              <span className="text-sm truncate">{entry.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-medium tabular-nums">{entry.value.toFixed(0)} USD</span>
                              <span className="text-xs text-muted-foreground w-10 text-right">
                                {totalRevenuePie > 0
                                  ? ((entry.value / totalRevenuePie) * 100).toFixed(0)
                                  : 0}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards with Sparklines */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-emerald-500 hover:shadow-md transition-all duration-200 relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Total Compte rendus</p>
                <p className="text-xl font-bold text-emerald-500 tabular-nums">{totals.revenue.toFixed(2)} {currencySymbol(churchCurrency)}</p>
              </div>
            </div>
            {sparklineRevenue.length > 1 && (
              <div className="h-8 mt-2 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparklineRevenue}>
                    <defs>
                      <linearGradient id="sparkGreen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-emerald-500)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--color-emerald-500)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="v" stroke="var(--color-emerald-500)" strokeWidth={1.5} fill="url(#sparkGreen)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-rose-500 hover:shadow-md transition-all duration-200 relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-500/10 rounded-lg">
                <TrendingDown className="h-5 w-5 text-rose-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Total Dépenses</p>
                <p className="text-xl font-bold text-rose-500 tabular-nums">{totals.expense.toFixed(2)} {currencySymbol(churchCurrency)}</p>
              </div>
            </div>
            {sparklineExpense.length > 1 && (
              <div className="h-8 mt-2 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparklineExpense}>
                    <defs>
                      <linearGradient id="sparkRose" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-rose-500)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--color-rose-500)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="v" stroke="var(--color-rose-500)" strokeWidth={1.5} fill="url(#sparkRose)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-violet-500 hover:shadow-md transition-all duration-200 relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-500/10 rounded-lg">
                <DollarSign className="h-5 w-5 text-violet-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">Solde</p>
                <p className="text-xl font-bold text-violet-500 tabular-nums">{totals.balance.toFixed(2)} {currencySymbol(churchCurrency)}</p>
              </div>
            </div>
            {sparklineBalance.length > 1 && (
              <div className="h-8 mt-2 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparklineBalance}>
                    <defs>
                      <linearGradient id="sparkViolet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-violet-500)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--color-violet-500)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="v" stroke="var(--color-violet-500)" strokeWidth={1.5} fill="url(#sparkViolet)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid: Bar Chart + Line Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Aperçu financier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              {chartDataLoading ? (
                <div className="h-full flex items-center justify-center">
                  <Skeleton className="h-full w-full rounded-lg" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`${value.toFixed(2)} USD`, '']}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Trend Line Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Tendances mensuelles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              {chartDataLoading ? (
                <div className="h-full flex items-center justify-center">
                  <Skeleton className="h-full w-full rounded-lg" />
                </div>
              ) : monthlyTrendData.every((m) => m["Compte rendus"] === 0 && m.Dépenses === 0) ? (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Données insuffisantes
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" className="text-xs" tick={{ fontSize: 11 }} />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`${value.toFixed(2)} USD`, '']}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="Compte rendus"
                      stroke="var(--color-emerald-500)"
                      strokeWidth={2}
                      dot={{ r: 4, fill: 'var(--color-emerald-500)' }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="Dépenses"
                      stroke="var(--color-rose-500)"
                      strokeWidth={2}
                      dot={{ r: 4, fill: 'var(--color-rose-500)' }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown Pie/Donut Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-primary" />
            Répartition des dépenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartDataLoading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : expenseCategoryData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              Données insuffisantes
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="h-56 w-56 shrink-0 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseCategoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {expenseCategoryData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`${value.toFixed(2)} USD`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-base font-bold">{totalExpensesPie.toFixed(0)} USD</p>
                </div>
              </div>
              {/* Legend */}
              <div className="flex-1 space-y-2 w-full">
                {expenseCategoryData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                      />
                      <span className="text-sm">{entry.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium tabular-nums">{entry.value.toFixed(2)} USD</span>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {totalExpensesPie > 0
                          ? ((entry.value / totalExpensesPie) * 100).toFixed(0)
                          : 0}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Devise" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes devises</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="FC">FC</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Lieu" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="bank">Banque</SelectItem>
                <SelectItem value="cash">Caisse</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead className="hidden sm:table-cell">Lieu</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="p-0">
                      <EmptyState
                        icon={DollarSign}
                        title="Aucune transaction trouvée"
                        description="Commencez par ajouter un compte rendu ou une dépense"
                        action={canCreateFinances(auth.role) ? { label: 'Ajouter une transaction', onClick: () => openCreate('revenue') } : undefined}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((t) => (
                    <TableRow key={t.id} className="hover:scale-[1.02] transition-transform duration-200">
                      <TableCell className="text-sm">
                        {new Date(t.date).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.type === 'revenue' ? 'default' : 'destructive'}>
                          {t.type === 'revenue' ? 'Compte rendu' : 'Dépense'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{t.category}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {t.description || '—'}
                      </TableCell>
                      <TableCell className={`font-semibold ${t.type === 'revenue' ? 'text-emerald-500' : 'text-red-500'}`}>
                        {t.type === 'revenue' ? '+' : '-'}{t.amount.toFixed(2)} {currencySymbol(t.currency)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className="gap-1">
                          {t.location === 'bank' ? <Building2 className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
                          {t.location === 'bank' ? 'Banque' : 'Caisse'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => generateFinancialPDF({
                              ...t,
                              type: t.type as 'revenue' | 'expense',
                              churchName: auth.churchName || 'MYCHURCH',
                              churchLogo: auth.churchLogo,
                            })}>
                              <FileText className="h-4 w-4 mr-2 text-primary" /> Imprimer PDF
                            </DropdownMenuItem>
                            {canEditFinances(auth.role) && (
                              <DropdownMenuItem onClick={() => openEdit(t)}>
                                <Edit className="h-4 w-4 mr-2" /> Modifier
                              </DropdownMenuItem>
                            )}
                            {canDeleteFinances(auth.role) && (
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(t.id)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Transaction Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-w-lg max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className={form.type === 'revenue' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
              {editing
                ? `Modifier la transaction (${form.type === 'revenue' ? 'Compte-rendu' : 'Dépense'})`
                : form.type === 'revenue'
                ? 'Nouveau Compte-rendu / Recette'
                : 'Nouvelle Dépense / Bon de sortie'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase font-semibold">Type de transaction</Label>
              <div className="flex gap-2">
                <Button
                  variant={form.type === 'revenue' ? 'default' : 'outline'}
                  className={`flex-1 ${form.type === 'revenue' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                  onClick={() => setForm({ ...form, type: 'revenue', category: '' })}
                >
                  <ArrowUpRight className="h-4 w-4 mr-1" /> Compte rendu (Recette)
                </Button>
                <Button
                  variant={form.type === 'expense' ? 'destructive' : 'outline'}
                  className="flex-1"
                  onClick={() => setForm({ ...form, type: 'expense', category: '' })}
                >
                  <ArrowDownRight className="h-4 w-4 mr-1" /> Dépense (Sortie)
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">N° Référence (Automatique)</Label>
                <Input
                  value={form.referenceNumber || nextRefNumber}
                  readOnly
                  disabled
                  className="bg-muted font-mono text-xs cursor-not-allowed opacity-80"
                />
                <p className="text-[10px] text-muted-foreground">Attribué automatiquement — non modifiable</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">
                  {form.type === 'revenue' ? 'Catégorie de Recette *' : 'Catégorie de Dépense *'}
                </Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(categories).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">
                  {form.type === 'revenue' ? 'Montant Recouvré *' : 'Montant Déboursé *'}
                </Label>
                <Input type="number" step="0.01" value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Devise</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v as Currency })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CURRENCY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Available balance warning for expenses */}
            {(() => {
              const normCurr = normalizeCurrencyCode(form.currency)
              const currInfo = currencies[normCurr] || { initialCapital: 0, revenue: 0, expense: 0, balance: 0 }
              const sym = currencySymbol(form.currency)
              const enteredAmount = parseFloat(form.amount) || 0
              const isOver = form.type === 'expense' && enteredAmount > 0 && enteredAmount > currInfo.balance
              if (form.type === 'expense') return (
                <div className={`rounded-lg px-3 py-2 text-xs flex items-start gap-2 ${isOver ? 'bg-rose-50 border border-rose-200 text-rose-700' : 'bg-muted/50 text-muted-foreground'}`}>
                  <span className="mt-0.5">{isOver ? '⚠️' : '💰'}</span>
                  <div>
                    <span className="font-semibold">Solde disponible en {form.currency} : </span>
                    <span className="font-mono">{currInfo.balance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {sym}</span>
                    {isOver && (
                      <p className="mt-0.5 font-semibold">Le montant saisi dépasse le solde disponible. La dépense sera refusée.</p>
                    )}
                  </div>
                </div>
              )
              return null
            })()}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">
                  {form.type === 'revenue' ? 'Lieu d\'Encaissement' : 'Lieu de Décaissement'}
                </Label>
                <Select value={form.location} onValueChange={(v) => setForm({ ...form, location: v as TransactionLocation })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Caisse Physique</SelectItem>
                    <SelectItem value="bank">Compte Bancaire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Date de Transaction *</Label>
                <Input type="date" value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Enregistré par (Responsable)</Label>
                <Input
                  value={form.recordedByName}
                  onChange={(e) => setForm({ ...form, recordedByName: e.target.value })}
                  placeholder="Prénom et Nom de l'enregistreur"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">
                  {form.type === 'revenue' ? 'Provenance / Déposant' : 'Bénéficiaire / Destinataire'}
                </Label>
                <Input
                  value={form.beneficiary}
                  onChange={(e) => setForm({ ...form, beneficiary: e.target.value })}
                  placeholder={form.type === 'revenue' ? 'Nom du donateur / provenance' : 'Nom du bénéficiaire payé'}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Membre concerné (optionnel)</Label>
              <Select value={form.memberId} onValueChange={(v) => setForm({ ...form, memberId: v })}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">
                {form.type === 'revenue' ? 'Motif du Compte-rendu' : 'Motif / Justification de la Dépense'}
              </Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={form.type === 'revenue' ? 'ex: Compte rendu du culte d\'action de grâce' : 'ex: Achat de matériel de sonorisation'}
              />
            </div>

            {/* Signature Pad */}
            <SignaturePad
              value={form.signatureData}
              onChange={(dataUrl) => setForm({ ...form, signatureData: dataUrl })}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={submitting} className={form.type === 'revenue' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}>
              {submitting ? 'Enregistrement...' : editing ? 'Modifier' : 'Valider'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}