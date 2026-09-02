'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useAppStore } from '@/store/app-store'
import { authFetch } from '@/lib/auth-fetch'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  BarChart3,
  Download,
  FileText,
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart as PieChartIcon,
  Calendar,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { REVENUE_LABELS, EXPENSE_LABELS } from '@/lib/constants'

interface Transaction {
  id: string
  type: 'revenue' | 'expense'
  category: string
  amount: number
  currency: string
  date: string
  description: string | null
}

interface Member {
  id: string
  status: string
  joinDate: string
  firstName: string
  lastName: string
}

interface AttendanceRecord {
  id: string
  date: string
  status: string
}

const PIE_COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6366f1', '#ec4899', '#14b8a6']

/* ─── Animated Counter Hook ─── */
function useAnimatedNumber(target: number, duration = 1200) {
  const [value, setValue] = useState(target)
  useEffect(() => {
    const start = performance.now()
    let rafId: number
    const animate = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) rafId = requestAnimationFrame(animate)
    }
    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [target, duration])
  return value
}

export function ReportsPage() {
  const { auth } = useAppStore()
  const [reportType, setReportType] = useState('financial')
  const [period, setPeriod] = useState('monthly')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().split('T')[0]
  })
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const fetchingRef = useRef(false)

  const fetchData = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    try {
      // Charge uniquement les données nécessaires au reportType (évite 300 lignes systématiques)
      const needFinances = reportType === 'financial' || reportType === 'complete'
      const needMembers = reportType === 'members' || reportType === 'complete'
      const needAttendance = reportType === 'members' || reportType === 'complete'
      const promises: Promise<Response>[] = []
      const keys: string[] = []
      if (needFinances) { promises.push(authFetch('/api/finances?limit=100')); keys.push('finances') }
      if (needMembers) { promises.push(authFetch('/api/members?limit=100')); keys.push('members') }
      if (needAttendance) { promises.push(authFetch('/api/attendance?limit=100')); keys.push('attendance') }
      const results = await Promise.all(promises)
      const map = new Map(keys.map((k, i) => [k, results[i]]))
      const fRes = map.get('finances')
      const mRes = map.get('members')
      const aRes = map.get('attendance')
      if (fRes?.ok) {
        const fData = await fRes.json()
        setTransactions(fData.transactions || fData.data || [])
      } else if (needFinances) setTransactions([])
      if (mRes?.ok) {
        const mData = await mRes.json()
        setMembers(mData.members || mData.data || [])
      } else if (needMembers) setMembers([])
      if (aRes?.ok) {
        const aData = await aRes.json()
        setAttendance(aData.attendance || aData.data || [])
      } else if (needAttendance) setAttendance([])
    } catch {
      toast.error('Erreur de chargement des données')
    } finally {
      fetchingRef.current = false
      setLoading(false)
    }
  }, [reportType])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter by period
  const filteredTransactions = useMemo(() => {
    const now = new Date()
    return transactions.filter((t) => {
      const d = new Date(t.date)
      if (period === 'weekly') {
        const weekAgo = new Date(now.getTime() - 7 * 86400000)
        return d >= weekAgo
      }
      if (period === 'monthly') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      }
      if (period === 'annual') {
        return d.getFullYear() === now.getFullYear()
      }
      return true
    })
  }, [transactions, period])

  // Financial calculations
  const totalRevenue = useMemo(
    () => filteredTransactions.filter((t) => t.type === 'revenue').reduce((s, t) => s + t.amount, 0),
    [filteredTransactions],
  )

  const totalExpense = useMemo(
    () => filteredTransactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    [filteredTransactions],
  )

  const netBalance = totalRevenue - totalExpense

  // Bar chart: Compte rendus vs Dépenses by month
  const barChartData = useMemo(() => {
    const monthMap: Record<string, { name: string; "Compte rendus": number; Dépenses: number }> = {}

    filteredTransactions.forEach((t) => {
      const d = new Date(t.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
      if (!monthMap[key]) monthMap[key] = { name: label, "Compte rendus": 0, Dépenses: 0 }
      if (t.type === 'revenue') monthMap[key]["Compte rendus"] += t.amount
      else monthMap[key].Dépenses += t.amount
    })

    return Object.values(monthMap)
  }, [filteredTransactions])

  // Line chart: Évolution du solde
  const balanceLineData = useMemo(() => {
    const monthMap: Record<string, { name: string; Solde: number }> = {}
    const sorted = [...filteredTransactions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    )

    let running = 0
    sorted.forEach((t) => {
      const d = new Date(t.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
      if (t.type === 'revenue') running += t.amount
      else running -= t.amount
      monthMap[key] = { name: label, Solde: running }
    })

    return Object.values(monthMap)
  }, [filteredTransactions])

  // Category breakdown table
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { category: string; revenue: number; expense: number }> = {}

    filteredTransactions.forEach((t) => {
      if (!map[t.category]) map[t.category] = { category: t.category, revenue: 0, expense: 0 }
      if (t.type === 'revenue') map[t.category].revenue += t.amount
      else map[t.category].expense += t.amount
    })

    return Object.values(map).sort((a, b) => (b.revenue + b.expense) - (a.revenue + a.expense))
  }, [filteredTransactions])

  // Member stats
  const memberStats = useMemo(() => {
    const active = members.filter((m) => m.status === 'active').length
    const inactive = members.filter((m) => m.status === 'inactive').length
    return { total: members.length, active, inactive }
  }, [members])

  const animRev = useAnimatedNumber(Math.round(totalRevenue))
  const animExp = useAnimatedNumber(Math.round(totalExpense))
  const animBal = useAnimatedNumber(Math.round(Math.abs(netBalance)))
  const animMembers = useAnimatedNumber(memberStats.total)
  const animActive = useAnimatedNumber(memberStats.active)
  const animInactive = useAnimatedNumber(memberStats.inactive)

  // Pie chart data
  const memberPieData = useMemo(() => [
    { name: 'Actifs', value: memberStats.active },
    { name: 'Inactifs', value: memberStats.inactive },
  ], [memberStats])

  // Growth indicator
  const growthRate = useMemo(() => {
    if (members.length === 0) return 0
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const oldCount = members.filter((m) => new Date(m.joinDate) < sixMonthsAgo).length
    const newCount = members.filter((m) => new Date(m.joinDate) >= sixMonthsAgo).length
    if (oldCount === 0) return newCount > 0 ? 100 : 0
    return Math.round((newCount / oldCount) * 100)
  }, [members])

  const tooltipStyle = {
    backgroundColor: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    color: 'hsl(var(--card-foreground))',
  }

  async function generatePDF() {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ])
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    let yPos = 15

    // Load church logo if available
    const logo = auth.churchLogo
    if (logo) {
      try {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = logo
        await new Promise<void>((resolve) => {
          img.onload = () => resolve()
          img.onerror = () => resolve()
          setTimeout(resolve, 2000)
        })
        if (img.complete && img.naturalWidth > 0) {
          doc.addImage(img, 'PNG', 15, yPos, 20, 20)
        }
      } catch {
        // ignore
      }
    }

    // Title
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(auth.churchName || 'MYCHURCH', logo ? 40 : 15, yPos + 12)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120, 120, 120)
    doc.text(`Rapport ${reportType === 'financial' ? 'Financier' : reportType === 'members' ? 'des Membres' : 'Complet'}`, logo ? 40 : 15, yPos + 19)
    doc.text(`Période: ${period === 'weekly' ? 'Hebdomadaire' : period === 'monthly' ? 'Mensuel' : 'Annuel'} | ${dateFrom} — ${dateTo}`, logo ? 40 : 15, yPos + 25)
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, logo ? 40 : 15, yPos + 31)

    doc.setDrawColor(200, 200, 200)
    doc.line(15, yPos + 35, pageWidth - 15, yPos + 35)
    yPos += 42

    // Financial data
    if (reportType === 'financial' || reportType === 'complete') {
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text('Rapport Financier', 15, yPos)
      yPos += 8

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Total Compte rendus: ${totalRevenue.toFixed(2)} USD`, 15, yPos)
      yPos += 6
      doc.text(`Total Dépenses: ${totalExpense.toFixed(2)} USD`, 15, yPos)
      yPos += 6
      doc.text(`Solde net: ${netBalance.toFixed(2)} USD`, 15, yPos)
      yPos += 10

      // Category breakdown table
      if (categoryBreakdown.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Catégorie', 'Compte rendus (USD)', 'Dépenses (USD)', 'Solde (USD)']],
          body: categoryBreakdown.map((c) => [
            REVENUE_LABELS[c.category as keyof typeof REVENUE_LABELS] || EXPENSE_LABELS[c.category as keyof typeof EXPENSE_LABELS] || c.category,
            c.revenue.toFixed(2),
            c.expense.toFixed(2),
            (c.revenue - c.expense).toFixed(2),
          ]),
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [99, 102, 241] },
        })
        yPos = (doc as any).lastAutoTable.finalY + 12
      }
    }

    // Members data
    if (reportType === 'members' || reportType === 'complete') {
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(0, 0, 0)
      doc.text('Rapport des Membres', 15, yPos)
      yPos += 8

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(`Total: ${memberStats.total} | Actifs: ${memberStats.active} | Inactifs: ${memberStats.inactive}`, 15, yPos)
      yPos += 6
      doc.text(`Taux de croissance (6 mois): ${growthRate >= 0 ? '+' : ''}${growthRate}%`, 15, yPos)
      yPos += 10

      // Members table
      if (members.length > 0) {
        autoTable(doc, {
          startY: yPos,
          head: [['Nom', 'Statut', 'Date d\'adhésion']],
          body: members.map((m) => [
            `${m.firstName} ${m.lastName}`,
            m.status === 'active' ? 'Actif' : 'Inactif',
            new Date(m.joinDate).toLocaleDateString('fr-FR'),
          ]),
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [99, 102, 241] },
        })
      }
    }

    // Footer
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150, 150, 150)
      doc.text(`MYCHURCH — Created by Henock Aduma`, 15, doc.internal.pageSize.getHeight() - 10)
      doc.text(`Page ${i}/${pageCount}`, pageWidth - 30, doc.internal.pageSize.getHeight() - 10)
    }

    doc.save(`rapport-mychurch-${reportType}-${dateFrom}-${dateTo}.pdf`)
  }

  function FinancialReportSection() {
    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-emerald-500 hover:shadow-md transition-all duration-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Compte rendus</p>
                  <p className="text-xl font-bold text-emerald-500 tabular-nums">
                    {animRev.toFixed(2)} USD
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-rose-500 hover:shadow-md transition-all duration-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-500/10 rounded-lg">
                  <TrendingDown className="h-5 w-5 text-rose-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Dépenses</p>
                  <p className="text-xl font-bold text-rose-500 tabular-nums">
                    {animExp.toFixed(2)} USD
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-violet-500 hover:shadow-md transition-all duration-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-500/10 rounded-lg">
                  <DollarSign className="h-5 w-5 text-violet-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Solde net</p>
                  <p className={`text-xl font-bold tabular-nums ${netBalance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {netBalance >= 0 ? '' : '-'}{animBal.toFixed(2)} USD
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section with grid pattern background */}
        <div className="relative">
          <div className="absolute inset-0 rounded-xl opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Compte rendus vs Dépenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            {barChartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                Aucune donnée pour cette période
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value.toFixed(2)} USD`, '']} />
                    <Legend />
                    <Bar dataKey="Compte rendus" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Dépenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Line Chart: Évolution du solde */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Évolution du solde
            </CardTitle>
          </CardHeader>
          <CardContent>
            {balanceLineData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                Aucune donnée pour cette période
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={balanceLineData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value.toFixed(2)} USD`, '']} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="Solde"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Breakdown Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Détail par catégorie
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length === 0 ? (
              <div className="h-24 flex items-center justify-center text-muted-foreground text-sm">
                Aucune donnée
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Catégorie</TableHead>
                      <TableHead className="text-right">Compte rendus</TableHead>
                      <TableHead className="text-right">Dépenses</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryBreakdown.map((row) => {
                      const label =
                        (REVENUE_LABELS as Record<string, string>)[row.category] ||
                        (EXPENSE_LABELS as Record<string, string>)[row.category] ||
                        row.category
                      const net = row.revenue - row.expense
                      return (
                        <TableRow key={row.category}>
                          <TableCell className="font-medium">{label}</TableCell>
                          <TableCell className="text-right text-emerald-500">
                            {row.revenue > 0 ? row.revenue.toFixed(2) : '—'}
                          </TableCell>
                          <TableCell className="text-right text-red-500">
                            {row.expense > 0 ? row.expense.toFixed(2) : '—'}
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${net >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {net.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
          </div>
        </div>
    )
  }

  function MembersReportSection() {
    return (
      <div className="space-y-6">
        {/* Member Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-violet-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-500/10 rounded-lg">
                  <Users className="h-5 w-5 text-violet-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Membres</p>
                  <p className="text-xl font-bold tabular-nums">{animMembers}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Actifs</p>
                  <p className="text-xl font-bold text-emerald-500 tabular-nums">{animActive}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/10 rounded-lg">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Inactifs</p>
                  <p className="text-xl font-bold text-red-500 tabular-nums">{animInactive}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pie Chart + Growth */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <PieChartIcon className="h-4 w-4" />
                Répartition par statut
              </CardTitle>
            </CardHeader>
            <CardContent>
              {memberStats.total === 0 ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  Aucun membre
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={memberPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {memberPieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Indicateurs de croissance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Taux de croissance (6 mois)</p>
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className={`text-2xl font-bold px-4 py-2 ${growthRate >= 0 ? 'text-emerald-500 border-emerald-300' : 'text-red-500 border-red-300'}`}
                  >
                    {growthRate >= 0 ? '+' : ''}{growthRate}%
                  </Badge>
                  {growthRate >= 0 ? (
                    <TrendingUp className="h-6 w-6 text-emerald-500" />
                  ) : (
                    <TrendingDown className="h-6 w-6 text-red-500" />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total présences enregistrées</p>
                <p className="text-2xl font-bold">{attendance.length}</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Présences ce mois</p>
                <p className="text-2xl font-bold">
                  {attendance.filter((a) => {
                    const d = new Date(a.date)
                    const now = new Date()
                    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
                  }).length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  function renderLoadingSkeleton() {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-6 w-28" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Rapports</h1>
      </div>

      {/* Selectors */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Type de rapport</p>
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="financial">Financier</SelectItem>
              <SelectItem value="members">Membres</SelectItem>
              <SelectItem value="complete">Complet</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Période</p>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Hebdomadaire</SelectItem>
              <SelectItem value="monthly">Mensuel</SelectItem>
              <SelectItem value="annual">Annuel</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Période personnalisée</p>
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 w-36 rounded-md border border-input bg-background px-3 pl-8 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <span className="text-xs text-muted-foreground font-medium">à</span>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 w-36 rounded-md border border-input bg-background px-3 pl-8 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-2 sm:self-end">
          <Button variant="outline" className="gap-1.5" onClick={generatePDF}>
            <Download className="h-4 w-4" />
            Exporter PDF
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={() => toast.info('Export Excel (bientôt disponible)')}>
            <FileText className="h-4 w-4" />
            Exporter Excel
          </Button>
          <Button className="gap-1.5" onClick={() => toast.info('Rapport en cours de génération...')}>
            <Download className="h-4 w-4" />
            Générer le rapport
          </Button>
        </div>
      </div>

      {/* Report Content */}
      {loading ? (
        renderLoadingSkeleton()
      ) : (
        <Tabs value={reportType} onValueChange={setReportType}>
          <div className="hidden">
            <TabsList>
              <TabsTrigger value="financial" />
              <TabsTrigger value="members" />
              <TabsTrigger value="complete" />
            </TabsList>
          </div>
          <TabsContent value="financial"><FinancialReportSection /></TabsContent>
          <TabsContent value="members"><MembersReportSection /></TabsContent>
          <TabsContent value="complete">
            <div className="space-y-6">
              <FinancialReportSection />
              <MembersReportSection />
            </div>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}