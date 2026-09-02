'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'
import { authFetch } from '@/lib/auth-fetch'
import { DEBT_STATUS_LABELS, CURRENCY_LABELS } from '@/lib/constants'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Landmark, Plus, Search, CheckCircle, XCircle, Trash2,
  ChevronLeft, ChevronRight, AlertTriangle, Clock, BadgeCheck, Ban,
  CreditCard, Filter,
} from 'lucide-react'

interface DebtPayment {
  id: string
  amount: number
  date: string
}

interface Debt {
  id: string
  amount: number
  currency: string
  creditor: string
  description?: string
  status: string
  createdBy: string
  approvedBy?: string
  approvalComment?: string
  date: string
  createdAt: string
  payments: DebtPayment[]
}

const createSchema = z.object({
  amount: z.coerce.number().positive('Le montant doit être positif'),
  currency: z.enum(['USD', 'FC', 'EUR']),
  creditor: z.string().min(1, 'Le créancier est requis'),
  description: z.string().optional(),
})

const approveSchema = z.object({
  comment: z.string().optional(),
})

type CreateValues = z.infer<typeof createSchema>
type ApproveValues = z.infer<typeof approveSchema>

function getStatusBadge(status: string) {
  const configs: Record<string, { label: string; className: string; icon: React.ElementType }> = {
    pending: { label: 'En attente', className: 'border-amber-400 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-300', icon: Clock },
    approved: { label: 'Approuvé', className: 'border-emerald-400 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-300', icon: BadgeCheck },
    rejected: { label: 'Rejeté', className: 'border-red-400 text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-300', icon: XCircle },
    paid: { label: 'Remboursé', className: 'border-blue-400 text-blue-700 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-300', icon: CheckCircle },
    cancelled: { label: 'Annulé', className: 'border-gray-400 text-gray-600 bg-gray-50 dark:bg-gray-800/30 dark:text-gray-300', icon: Ban },
  }
  const config = configs[status] || configs.pending
  const Icon = config.icon
  return (
    <Badge variant="outline" className={`gap-1 ${config.className}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}

export function DebtsPage() {
  const auth = useAppStore((s) => s.auth)
  const isAdmin = auth.role === 'admin'
  const isTreasurerOrAdmin = auth.role === 'admin' || auth.role === 'treasurer'

  const [debts, setDebts] = useState<Debt[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [approveDebt, setApproveDebt] = useState<Debt | null>(null)
  const [rejectDebt, setRejectDebt] = useState<Debt | null>(null)
  const [deleteDebt, setDeleteDebt] = useState<Debt | null>(null)
  const [approveLoading, setApproveLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const limit = 15

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema) as any,
    defaultValues: { amount: 0, currency: 'USD', creditor: '', description: '' },
  })

  const approveForm = useForm<ApproveValues>({
    resolver: zodResolver(approveSchema) as any,
    defaultValues: { comment: '' },
  })

  const fetchDebts = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(limit) })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await authFetch(`/api/debts?${params}`)
      if (res.ok) {
        const data = await res.json()
        setDebts(data.debts ?? [])
        setTotal(data.pagination?.total ?? 0)
        setPendingCount(data.pendingCount ?? 0)
      }
    } catch {
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [auth.token, page, statusFilter, limit])

  useEffect(() => { fetchDebts(page) }, [fetchDebts, page, statusFilter])

  const handleCreate = async (values: CreateValues) => {
    setSubmitting(true)
    try {
      const res = await authFetch('/api/debts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(data.autoApproved ? 'Dette créée et approuvée automatiquement ✅' : 'Dette créée — en attente d\'approbation')
        setShowCreateModal(false)
        form.reset()
        fetchDebts(1)
        setPage(1)
      } else {
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setSubmitting(false)
    }
  }

  const handleApprove = async (action: 'approved' | 'rejected') => {
    if (!approveDebt && !rejectDebt) return
    const target = action === 'approved' ? approveDebt : rejectDebt
    if (!target) return
    setApproveLoading(true)
    const comment = approveForm.getValues('comment')
    try {
      const res = await authFetch('/api/debts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debtId: target.id, action, comment }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(action === 'approved' ? 'Dette approuvée ✅' : 'Dette rejetée')
        setApproveDebt(null)
        setRejectDebt(null)
        approveForm.reset()
        fetchDebts(page)
      } else {
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setApproveLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteDebt) return
    setDeleteLoading(true)
    try {
      const res = await authFetch(`/api/debts?id=${deleteDebt.id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Dette supprimée')
        setDeleteDebt(null)
        fetchDebts(page)
      } else {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setDeleteLoading(false)
    }
  }

  const filtered = debts.filter(d =>
    d.creditor.toLowerCase().includes(search.toLowerCase()) ||
    (d.description || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.ceil(total / limit)

  const totalByStatus = {
    pending: debts.filter(d => d.status === 'pending').reduce((s, d) => s + d.amount, 0),
    approved: debts.filter(d => d.status === 'approved').reduce((s, d) => s + d.amount, 0),
    paid: debts.filter(d => d.status === 'paid').reduce((s, d) => s + d.amount, 0),
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-950/50">
          <Landmark className="h-5 w-5 text-rose-600 dark:text-rose-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestion des Dettes</h1>
          <p className="text-sm text-muted-foreground">Suivi des emprunts et remboursements</p>
        </div>
        {pendingCount > 0 && isAdmin && (
          <Badge className="ml-auto bg-amber-500 text-white hover:bg-amber-600">
            {pendingCount} en attente
          </Badge>
        )}
      </div>

      <Separator />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-amber-200 dark:border-amber-800/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-muted-foreground">En attente</span>
            </div>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {totalByStatus.pending.toLocaleString('fr-FR')} USD
            </p>
          </CardContent>
        </Card>
        <Card className="border-emerald-200 dark:border-emerald-800/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-muted-foreground">Approuvées</span>
            </div>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {totalByStatus.approved.toLocaleString('fr-FR')} USD
            </p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 dark:border-blue-800/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Remboursées</span>
            </div>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
              {totalByStatus.paid.toLocaleString('fr-FR')} USD
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par créancier ou description..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="approved">Approuvé</SelectItem>
              <SelectItem value="rejected">Rejeté</SelectItem>
              <SelectItem value="paid">Remboursé</SelectItem>
              <SelectItem value="cancelled">Annulé</SelectItem>
            </SelectContent>
          </Select>
          {isTreasurerOrAdmin && (
            <Button onClick={() => setShowCreateModal(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nouvelle dette
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Landmark className="h-10 w-10 opacity-30" />
              <p className="text-sm">Aucune dette trouvée</p>
              {isTreasurerOrAdmin && (
                <Button variant="outline" size="sm" onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Créer une dette
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Créancier</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(debt => (
                  <TableRow key={debt.id}>
                    <TableCell className="font-medium">{debt.creditor}</TableCell>
                    <TableCell className="font-mono font-semibold">
                      {debt.amount.toLocaleString('fr-FR')} {debt.currency}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {debt.description || '—'}
                    </TableCell>
                    <TableCell>{getStatusBadge(debt.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(debt.date), 'dd MMM yyyy', { locale: fr })}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {debt.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                onClick={() => { setApproveDebt(debt); approveForm.reset() }}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-950/30"
                                onClick={() => { setRejectDebt(debt); approveForm.reset() }}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            onClick={() => setDeleteDebt(debt)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total} dette{total > 1 ? 's' : ''} au total
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-rose-500" />
              Nouvelle dette
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Montant *</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Devise *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(CURRENCY_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="creditor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Créancier *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom du créancier ou organisation" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Motif ou détails de la dette..." rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 p-3 flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {auth.role === 'admin'
                    ? 'En tant qu\'administrateur, la dette sera approuvée automatiquement.'
                    : 'La dette sera soumise à l\'approbation d\'un administrateur.'}
                </p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>Annuler</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Création...' : 'Créer la dette'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Approve Modal */}
      <Dialog open={!!approveDebt} onOpenChange={(o) => !o && setApproveDebt(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle className="h-5 w-5" />
              Approuver la dette
            </DialogTitle>
          </DialogHeader>
          {approveDebt && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Créancier:</span>
                  <span className="font-medium">{approveDebt.creditor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Montant:</span>
                  <span className="font-bold">{approveDebt.amount.toLocaleString('fr-FR')} {approveDebt.currency}</span>
                </div>
              </div>
              <Form {...approveForm}>
                <FormField
                  control={approveForm.control}
                  name="comment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commentaire (optionnel)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Raison d'approbation..." rows={2} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </Form>
              <DialogFooter>
                <Button variant="outline" onClick={() => setApproveDebt(null)}>Annuler</Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={approveLoading}
                  onClick={() => handleApprove('approved')}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  {approveLoading ? 'En cours...' : 'Approuver'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={!!rejectDebt} onOpenChange={(o) => !o && setRejectDebt(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Rejeter la dette
            </DialogTitle>
          </DialogHeader>
          {rejectDebt && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Créancier:</span>
                  <span className="font-medium">{rejectDebt.creditor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Montant:</span>
                  <span className="font-bold">{rejectDebt.amount.toLocaleString('fr-FR')} {rejectDebt.currency}</span>
                </div>
              </div>
              <Form {...approveForm}>
                <FormField
                  control={approveForm.control}
                  name="comment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Raison du rejet (optionnel)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Raison du rejet..." rows={2} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </Form>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRejectDebt(null)}>Annuler</Button>
                <Button
                  variant="destructive"
                  disabled={approveLoading}
                  onClick={() => handleApprove('rejected')}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  {approveLoading ? 'En cours...' : 'Rejeter'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteDebt} onOpenChange={(o) => !o && setDeleteDebt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette dette ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La dette de{' '}
              <strong>{deleteDebt?.amount.toLocaleString('fr-FR')} {deleteDebt?.currency}</strong>{' '}
              auprès de <strong>{deleteDebt?.creditor}</strong> sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
