'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Archive, Plus, Trash2, ChevronLeft, ChevronRight, FolderArchive,
  Database, FileDown, RefreshCw, RotateCcw,
} from 'lucide-react'
import { Label } from '@/components/ui/label'

interface ArchiveRecord {
  id: string
  type: string
  period: string
  size: number
  recordCount: number
  userId?: string
  data?: string
  createdAt: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function getTypeLabel(type: string): string {
  return type === 'monthly' ? 'Mensuel' : type === 'annual' ? 'Annuel' : type
}

function getTypeBadge(type: string) {
  return type === 'annual' ? (
    <Badge variant="outline" className="border-violet-400 text-violet-700 bg-violet-50 dark:bg-violet-950/30 dark:text-violet-300">
      Annuel
    </Badge>
  ) : (
    <Badge variant="outline" className="border-blue-400 text-blue-700 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-300">
      Mensuel
    </Badge>
  )
}

const MONTHS = [
  { value: '01', label: 'Janvier' }, { value: '02', label: 'Février' },
  { value: '03', label: 'Mars' }, { value: '04', label: 'Avril' },
  { value: '05', label: 'Mai' }, { value: '06', label: 'Juin' },
  { value: '07', label: 'Juillet' }, { value: '08', label: 'Août' },
  { value: '09', label: 'Septembre' }, { value: '10', label: 'Octobre' },
  { value: '11', label: 'Novembre' }, { value: '12', label: 'Décembre' },
]

function buildPeriodOptions() {
  const now = new Date()
  const years: number[] = []
  for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) years.push(y)
  return years
}

export function ArchivesPage() {
  const auth = useAppStore((s) => s.auth)
  const isAdmin = auth.role === 'admin'

  const [archives, setArchives] = useState<ArchiveRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deleteArchive, setDeleteArchive] = useState<ArchiveRecord | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [restoreArchive, setRestoreArchive] = useState<ArchiveRecord | null>(null)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [typeFilter, setTypeFilter] = useState('all')

  // Create form state
  const [archiveType, setArchiveType] = useState<'monthly' | 'annual'>('monthly')
  const [archiveYear, setArchiveYear] = useState(String(new Date().getFullYear()))
  const [archiveMonth, setArchiveMonth] = useState(
    String(new Date().getMonth() + 1).padStart(2, '0')
  )

  const limit = 15
  const years = buildPeriodOptions()

  const fetchArchives = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(limit) })
      if (typeFilter !== 'all') params.set('type', typeFilter)
      const res = await fetch(`/api/archives?${params}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (res.ok) {
        const data = await res.json()
        setArchives(data.archives ?? [])
        setTotal(data.pagination?.total ?? 0)
      }
    } catch {
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [auth.token, page, typeFilter, limit])

  useEffect(() => { fetchArchives(page) }, [fetchArchives, page, typeFilter])

  const handleCreate = async () => {
    setCreating(true)
    const period = archiveType === 'annual' ? archiveYear : `${archiveYear}-${archiveMonth}`
    try {
      const res = await fetch('/api/archives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ type: archiveType, period }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Archive ${getTypeLabel(archiveType)} créée pour ${period} ✅`)
        setShowCreateModal(false)
        fetchArchives(1)
        setPage(1)
      } else {
        toast.error(data.error || 'Erreur lors de la création')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteArchive) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/archives?id=${deleteArchive.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      if (res.ok) {
        toast.success('Archive supprimée')
        setDeleteArchive(null)
        fetchArchives(page)
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

  const handleRestore = async () => {
    if (!restoreArchive) return
    setRestoreLoading(true)
    try {
      const res = await fetch(`/api/archives?id=${restoreArchive.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${auth.token}` },
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Archive restaurée : ${data.restoredCount} enregistrement(s) récupéré(s)`)
        setRestoreArchive(null)
      } else {
        toast.error(data.error || 'Erreur lors de la restauration')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setRestoreLoading(false)
    }
  }

  const handleDownload = (archive: ArchiveRecord) => {
    try {
      const parsed = JSON.parse(archive.data || '{}')
      const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `archive-${archive.type}-${archive.period}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Archive téléchargée')
    } catch {
      toast.error('Erreur lors du téléchargement')
    }
  }

  const totalPages = Math.ceil(total / limit)
  const totalSize = archives.reduce((s, a) => s + (a.size || 0), 0)
  const totalRecords = archives.reduce((s, a) => s + (a.recordCount || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/50">
          <FolderArchive className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Archives</h1>
          <p className="text-sm text-muted-foreground">Sauvegarde et historique des données de l'église</p>
        </div>
      </div>

      <Separator />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Archive className="h-4 w-4 text-indigo-500" />
              <span className="text-sm text-muted-foreground">Total archives</span>
            </div>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-emerald-500" />
              <span className="text-sm text-muted-foreground">Enregistrements</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {totalRecords.toLocaleString('fr-FR')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <FileDown className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Taille totale</span>
            </div>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">{formatSize(totalSize)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-2 flex-1">
          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1) }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="monthly">Mensuel</SelectItem>
              <SelectItem value="annual">Annuel</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => fetchArchives(page)} title="Rafraîchir">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreateModal(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Créer une archive
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : archives.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <FolderArchive className="h-10 w-10 opacity-30" />
              <p className="text-sm">Aucune archive disponible</p>
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Créer une archive
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Enregistrements</TableHead>
                  <TableHead>Taille</TableHead>
                  <TableHead>Créée le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archives.map(archive => (
                  <TableRow key={archive.id}>
                    <TableCell>{getTypeBadge(archive.type)}</TableCell>
                    <TableCell className="font-mono font-medium">{archive.period}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Database className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{archive.recordCount?.toLocaleString('fr-FR') ?? 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatSize(archive.size || 0)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(archive.createdAt), 'dd MMM yyyy, HH:mm', { locale: fr })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 gap-1 text-xs"
                          onClick={() => handleDownload(archive)}
                        >
                          <FileDown className="h-3.5 w-3.5" />
                          JSON
                        </Button>
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 gap-1 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                            onClick={() => setRestoreArchive(archive)}
                            title="Restaurer les données de cette archive"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Restaurer
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            onClick={() => setDeleteArchive(archive)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{total} archive{total > 1 ? 's' : ''}</p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">Page {page} / {totalPages}</span>
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

      {/* Create Archive Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderArchive className="h-5 w-5 text-indigo-500" />
              Créer une archive
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type d'archive</Label>
              <Select value={archiveType} onValueChange={(v) => setArchiveType(v as 'monthly' | 'annual')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensuel</SelectItem>
                  <SelectItem value="annual">Annuel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Année</Label>
              <Select value={archiveYear} onValueChange={setArchiveYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {archiveType === 'monthly' && (
              <div className="space-y-2">
                <Label>Mois</Label>
                <Select value={archiveMonth} onValueChange={setArchiveMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 p-3">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                L'archive capturera un instantané de toutes les données actuelles (transactions, membres, événements, présences).
                La période archivée sera : <strong>{archiveType === 'annual' ? archiveYear : `${archiveYear}-${archiveMonth}`}</strong>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Annuler</Button>
            <Button disabled={creating} onClick={handleCreate}>
              <Archive className="h-4 w-4 mr-1" />
              {creating ? 'Création...' : 'Créer l\'archive'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteArchive} onOpenChange={(o) => !o && setDeleteArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette archive ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'archive{' '}
              <strong>{deleteArchive?.type} — {deleteArchive?.period}</strong>{' '}
              sera définitivement supprimée.
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

      {/* Restore Confirmation */}
      <AlertDialog open={!!restoreArchive} onOpenChange={(o) => !o && setRestoreArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-emerald-600" />
              Restaurer cette archive ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Les données de l&apos;archive <strong>{restoreArchive?.type} — {restoreArchive?.period}</strong>{' '}
              ({restoreArchive?.recordCount?.toLocaleString('fr-FR')} enregistrements) seront réimportées dans la base de données active.
              Les enregistrements déjà existants ne seront pas écrasés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleRestore}
              disabled={restoreLoading}
            >
              {restoreLoading ? 'Restauration...' : 'Restaurer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
