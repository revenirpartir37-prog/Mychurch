'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAppStore } from '@/store/app-store'
import { useSupabaseRealtime } from '@/hooks/use-supabase-realtime'
import { CREATOR } from '@/lib/constants'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { authFetch } from '@/lib/auth-fetch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose,
} from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Plus, Search, Filter, Edit, Trash2, Eye, Camera, Upload, UserPlus, X, MoreHorizontal,
  ChevronLeft, ChevronRight, Building2, Download, ChevronDown, ChevronUp,
  FileSpreadsheet, UserCheck, UserX, FileDown,
  Users, CheckSquare, Square, ArrowLeftRight, Link2,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import { EmptyState } from '@/components/mychurch/shared/empty-state'
import { downloadCSV } from '@/lib/csv-utils'
import { uploadImage } from '@/lib/upload-image'
import { MemberDetailDrawer } from '@/components/mychurch/dashboard/member-detail-drawer'
import { canCreateMembers, canEditMembers, canDeleteMembers } from '@/lib/frontend-rbac'

interface Member {
  id: string
  firstName: string
  lastName: string
  type?: string
  phone: string | null
  email: string | null
  address: string | null
  department: string | null
  function: string | null
  salary?: number | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  photo: string | null
  status: string
  joinDate: string
}

interface DepartmentInfo {
  name: string
  count: number
}

const emptyMember = {
  firstName: '', lastName: '', type: 'member' as 'member' | 'personnel', phone: '', email: '', address: '',
  department: '', function: '', salary: '', emergencyContactName: '', emergencyContactPhone: '',
  photo: null as string | null,
}

/* ─── Avatar color palette based on first letter ─── */
const AVATAR_PALETTE = [
  'bg-rose-500 text-white',
  'bg-amber-500 text-white',
  'bg-emerald-500 text-white',
  'bg-cyan-500 text-white',
  'bg-violet-500 text-white',
  'bg-orange-500 text-white',
  'bg-teal-500 text-white',
  'bg-pink-500 text-white',
  'bg-indigo-500 text-white',
  'bg-lime-600 text-white',
  'bg-fuchsia-500 text-white',
  'bg-sky-500 text-white',
  'bg-red-500 text-white',
  'bg-green-600 text-white',
  'bg-yellow-500 text-white',
  'bg-purple-500 text-white',
  'bg-blue-500 text-white',
  'bg-stone-500 text-white',
  'bg-olive-600 text-white',
  'bg-coral-500 text-white',
]

function getAvatarColor(name: string): string {
  const firstLetter = (name || '').charAt(0).toUpperCase()
  const code = firstLetter.charCodeAt(0)
  return AVATAR_PALETTE[code % AVATAR_PALETTE.length]
}



function generateCSVTemplate(): string {
  const BOM = '\uFEFF'
  const headers = 'prenom,nom,email,telephone,adresse,departement,fonction,statut'
  const example1 = 'Jean,Dupont,jean@exemple.com,+243812345678,123 Rue A,Chorale,Chanteur,actif'
  const example2 = 'Marie,Mukendi,marie@exemple.com,+243998765432,456 Avenue B,Accueil,Responsable,inactif'
  return BOM + `${headers}\n${example1}\n${example2}\n`
}

export function MembersPage() {
  const { auth } = useAppStore()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [deptTextFilter, setDeptTextFilter] = useState('')
  const [exporting, setExporting] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 10

  // Departments extracted from all members
  const [departments, setDepartments] = useState<DepartmentInfo[]>([])
  const [loadingDeps, setLoadingDeps] = useState(true)

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [form, setForm] = useState(emptyMember)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)

  // CSV Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fetchingRef = useRef(false)

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [batchLoading, setBatchLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMember, setDrawerMember] = useState<Member | null>(null)

  // Register link dialog state
  const [registerLinkOpen, setRegisterLinkOpen] = useState(false)
  const [registerLink, setRegisterLink] = useState('')
  const [registerLinkLoading, setRegisterLinkLoading] = useState(false)

  // Fetch departments (all members with department field, no pagination)
  const fetchDepartments = useCallback(async () => {
    setLoadingDeps(true)
    try {
      const res = await authFetch('/api/members?limit=100')
      if (res.ok) {
        const data = await res.json()
        const allMembers: Member[] = data.members || data.data || []
        const deptMap = new Map<string, number>()
        allMembers.forEach((m) => {
          if (m.department && m.department.trim()) {
            deptMap.set(m.department, (deptMap.get(m.department) || 0) + 1)
          }
        })
        const sorted = Array.from(deptMap.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
        setDepartments(sorted)
      }
    } catch {
      // Silent fail - departments are non-critical
    } finally {
      setLoadingDeps(false)
    }
  }, [])

  const fetchMembers = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search && { search }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(departmentFilter && { department: departmentFilter }),
        ...(dateFrom && { startDate: dateFrom }),
        ...(dateTo && { endDate: dateTo }),
      })
      const res = await authFetch(`/api/members?${params}`)
      if (res.ok) {
        const data = await res.json()
        setMembers(data.members || data.data || [])
        setTotal(data.pagination?.total ?? data.total ?? 0)
      }
    } catch (err) {
      console.error(err)
    } finally {
      fetchingRef.current = false
      setLoading(false)
    }
  }, [search, statusFilter, departmentFilter, page, dateFrom, dateTo, limit])

  const handleExportCSV = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams({
        limit: '9999',
        ...(search && { search }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(departmentFilter && { department: departmentFilter }),
        ...(dateFrom && { startDate: dateFrom }),
        ...(dateTo && { endDate: dateTo }),
      })
      const res = await authFetch(`/api/members?${params}`)
      if (!res.ok) {
        toast.error('Erreur lors de l\'export')
        return
      }
      const data = await res.json()
      const allMembers: Member[] = data.members || data.data || []

      const today = new Date().toISOString().slice(0, 10)
      downloadCSV(
        allMembers.map((m) => ({
          firstName: m.firstName,
          lastName: m.lastName,
          phone: m.phone || '',
          email: m.email || '',
          address: m.address || '',
          department: m.department || '',
          function: m.function || '',
          status: m.status === 'active' ? 'Actif' : 'Inactif',
          joinDate: new Date(m.joinDate).toLocaleDateString('fr-FR'),
        })),
        `membres_export_${today}.csv`,
        [
          { key: 'firstName', label: 'Prénom' },
          { key: 'lastName', label: 'Nom' },
          { key: 'phone', label: 'Téléphone' },
          { key: 'email', label: 'Email' },
          { key: 'address', label: 'Adresse' },
          { key: 'department', label: 'Département' },
          { key: 'function', label: 'Fonction' },
          { key: 'status', label: 'Statut' },
          { key: 'joinDate', label: 'Date d\'inscription' },
        ],
      )
      toast.success(`${allMembers.length} membre(s) exporté(s)`)
    } catch {
      toast.error('Erreur lors de l\'export')
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => { fetchMembers() }, [fetchMembers])
  useEffect(() => { fetchDepartments() }, [fetchDepartments])

  // Realtime : rafraîchit la liste dès qu'un membre change (en + du polling)
  useSupabaseRealtime(['member'], () => fetchMembers(), auth.churchId)

  // Clear selection when page/filters change
  useEffect(() => { setSelectedIds(new Set()) }, [fetchMembers])

  const totalPages = Math.ceil(total / limit)

  const openDrawer = useCallback((member: Member) => {
    setDrawerMember(member)
    setDrawerOpen(true)
  }, [])

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
    setDrawerMember(null)
  }, [])

  const handleDepartmentClick = (deptName: string) => {
    if (departmentFilter === deptName) {
      setDepartmentFilter('')
    } else {
      setDepartmentFilter(deptName)
    }
    setPage(1)
  }

  const handleOpenCreate = () => {
    setEditingMember(null)
    setForm(emptyMember)
    setDialogOpen(true)
  }

  const handleOpenEdit = (member: Member) => {
    setEditingMember(member)
    setForm({
      firstName: member.firstName,
      lastName: member.lastName,
      type: (member.type === 'personnel' ? 'personnel' : 'member') as 'member' | 'personnel',
      phone: member.phone || '',
      email: member.email || '',
      address: member.address || '',
      department: member.department || '',
      function: member.function || '',
      salary: member.salary != null ? String(member.salary) : '',
      emergencyContactName: member.emergencyContactName || '',
      emergencyContactPhone: member.emergencyContactPhone || '',
      photo: member.photo,
    })
    setDialogOpen(true)
  }

  const handleOpenRegisterLink = async () => {
    setRegisterLinkLoading(true)
    try {
      const res = await authFetch('/api/churches/registration-link')
      if (res.ok) {
        const data = await res.json()
        setRegisterLink(data.url || '')
        setRegisterLinkOpen(true)
      } else {
        const err = await res.json()
        toast.error(err.error || 'Erreur lors de la génération du lien')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setRegisterLinkLoading(false)
    }
  }

  const handleCopyRegisterLink = async () => {
    if (!registerLink) return
    try {
      await navigator.clipboard.writeText(registerLink)
      toast.success('Lien copié dans le presse-papiers !')
    } catch {
      toast.error('Impossible de copier le lien')
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadImage(file, 'members', auth.token)
      setForm((f) => ({ ...f, photo: url }))
      toast.success('Photo téléchargée')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de téléchargement')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.firstName || !form.lastName) {
      toast.error('Prénom et nom sont obligatoires')
      return
    }
    setSubmitting(true)
    try {
      const url = editingMember ? `/api/members?id=${editingMember.id}` : '/api/members'
      const method = editingMember ? 'PUT' : 'POST'
      const res = await authFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          salary: form.type === 'personnel' && form.salary !== '' ? parseFloat(form.salary) : null,
          department: form.type === 'personnel' ? form.department || null : form.department,
        }),
      })
      if (res.ok) {
        toast.success(editingMember ? 'Membre modifié' : 'Membre ajouté')
        setDialogOpen(false)
        fetchMembers()
        fetchDepartments()
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
      const res = await authFetch(`/api/members?id=${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        toast.success('Membre supprimé')
        fetchMembers()
        fetchDepartments()
      }
    } catch {
      toast.error('Erreur')
    }
  }

  const handleToggleStatus = async (member: Member) => {
    try {
      const res = await authFetch(`/api/members?id=${member.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: member.status === 'active' ? 'inactive' : 'active' }),
      })
      if (res.ok) {
        toast.success('Statut mis à jour')
        fetchMembers()
        fetchDepartments()
      }
    } catch {
      toast.error('Erreur')
    }
  }

  // ─── CSV Import Handlers ───
  const handleDownloadTemplate = () => {
    const csv = generateCSVTemplate()
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'modele_import_membres.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && (file.name.endsWith('.csv') || file.type === 'text/csv')) {
      setImportFile(file)
    } else {
      toast.error('Veuillez sélectionner un fichier CSV')
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) setImportFile(file)
  }

  const handleImport = async () => {
    if (!importFile) {
      toast.error('Veuillez sélectionner un fichier')
      return
    }
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      const res = await authFetch('/api/members/import', {
        method: 'POST',
        body: fd,
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(`Import terminé : ${data.imported} ajouté(s), ${data.skipped} ignoré(s) sur ${data.total} ligne(s)`)
        setImportDialogOpen(false)
        setImportFile(null)
        fetchMembers()
        fetchDepartments()
      } else {
        const err = await res.json()
        toast.error(err.error || 'Erreur lors de l\'import')
      }
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setImporting(false)
    }
  }

  // ─── Batch Selection Handlers ───
  const allPageSelected = members.length > 0 && members.every((m) => selectedIds.has(m.id))
  const somePageSelected = members.some((m) => selectedIds.has(m.id)) && !allPageSelected

  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(members.map((m) => m.id)))
    }
  }

  const toggleSelectMember = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleBatchDelete = async () => {
    setBatchLoading(true)
    try {
      const ids = Array.from(selectedIds)
      const res = await authFetch('/api/members', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids }),
      })
      if (res.ok) {
        const data = await res.json()
        toast.success(`${data.deleted} membre(s) supprimé(s)`)
      } else {
        toast.error('Erreur lors de la suppression')
      }
      setSelectedIds(new Set())
      setDeleteDialogOpen(false)
      fetchMembers()
      fetchDepartments()
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setBatchLoading(false)
    }
  }

  const handleBatchStatusChange = async (status: 'active' | 'inactive') => {
    setBatchLoading(true)
    try {
      const ids = Array.from(selectedIds)
      let successCount = 0
      for (const id of ids) {
        const res = await authFetch(`/api/members?id=${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status }),
        })
        if (res.ok) successCount++
      }
      toast.success(`${successCount} membre(s) marqué(s) comme ${status === 'active' ? 'actif(s)' : 'inactif(s)'}`)
      setSelectedIds(new Set())
      fetchMembers()
      fetchDepartments()
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setBatchLoading(false)
    }
  }

  return (
    <TooltipProvider>
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Gestion des Membres</h1>
          <Badge variant="secondary" className="text-sm px-2.5 py-0.5">
            {total} membre(s)
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={selectionMode ? 'default' : 'outline'}
                size="icon"
                onClick={() => { setSelectionMode(!selectionMode); setSelectedIds(new Set()) }}
                aria-label="Mode sélection"
              >
                {selectionMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{selectionMode ? 'Quitter la sélection' : 'Mode sélection'}</TooltipContent>
          </Tooltip>
          <Button variant="outline" onClick={handleExportCSV} disabled={exporting || members.length === 0} className="gap-2">
            <Download className="h-4 w-4" />
            {exporting ? 'Export...' : 'Exporter CSV'}
          </Button>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Importer CSV
          </Button>
          <Button variant="outline" onClick={handleOpenRegisterLink} disabled={registerLinkLoading} className="gap-2">
            <Link2 className="h-4 w-4" />
            {registerLinkLoading ? 'Génération...' : 'Lien d\'inscription'}
          </Button>
          {canCreateMembers(auth.role) && (
            <Button onClick={handleOpenCreate} className="gap-2 w-fit">
              <UserPlus className="h-4 w-4" /> Ajouter un membre
            </Button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom, email, téléphone..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="inactive">Inactif</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="gap-2 w-full sm:w-auto"
            >
              <Filter className="h-4 w-4" />
              {showAdvancedFilters ? (
                <><ChevronUp className="h-4 w-4" /> Masquer les filtres</>
              ) : (
                <><ChevronDown className="h-4 w-4" /> Afficher les filtres</>
              )}
            </Button>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Département</Label>
                <Input
                  placeholder="Filtrer par département"
                  value={deptTextFilter}
                  onChange={(e) => { setDeptTextFilter(e.target.value); setDepartmentFilter(e.target.value); setPage(1) }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Date d'adhésion (depuis)</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Date d'adhésion (avant)</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
                />
              </div>
            </div>
          )}

        </CardContent>
      </Card>

      {/* Department Chips */}
      {departments.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Building2 className="h-4 w-4" />
            Départements
          </div>
          <div className="flex flex-wrap gap-2">
            {/* "Tous" chip */}
            <button
              type="button"
              onClick={() => { setDepartmentFilter(''); setPage(1) }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border ${
                !departmentFilter
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
              }`}
            >
              Tous
              <span className={`text-xs ${!departmentFilter ? 'text-primary-foreground/70' : 'text-muted-foreground/60'}`}>
                {departments.reduce((sum, d) => sum + d.count, 0)}
              </span>
            </button>
            {departments.map((dept) => (
              <button
                key={dept.name}
                type="button"
                onClick={() => handleDepartmentClick(dept.name)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border ${
                  departmentFilter === dept.name
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                }`}
              >
                {dept.name}
                <span className={`text-xs ${departmentFilter === dept.name ? 'text-primary-foreground/70' : 'text-muted-foreground/60'}`}>
                  {dept.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Members Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {selectionMode && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Tout sélectionner"
                      />
                    </TableHead>
                  )}
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead className="hidden md:table-cell">Téléphone</TableHead>
                  <TableHead className="hidden lg:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">Département</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-[88px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {selectionMode && <TableCell><Skeleton className="h-4 w-4" /></TableCell>}
                      <TableCell><Skeleton className="h-8 w-8 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                    </TableRow>
                  ))
                ) : members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={selectionMode ? 8 : 7} className="p-0">
                      <EmptyState
                        icon={Users}
                        title="Aucun membre trouvé"
                        description="Ajoutez votre premier membre pour commencer"
                        action={{ label: 'Ajouter un membre', onClick: handleOpenCreate }}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((member) => (
                    <TableRow key={member.id} className={`${selectionMode && selectedIds.has(member.id) ? 'bg-muted/50' : ''} cursor-pointer`} onClick={(e) => {
                      const target = e.target as HTMLElement
                      if (target.closest('button') || target.closest('input') || target.closest('[role="checkbox"]')) return
                      openDrawer(member)
                    }}>
                      {selectionMode && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(member.id)}
                            onCheckedChange={() => toggleSelectMember(member.id)}
                            aria-label={`Sélectionner ${member.firstName} ${member.lastName}`}
                          />
                        </TableCell>
                      )}
                      <TableCell>
                        <Avatar className="h-8 w-8">
                          {member.photo && <AvatarImage src={member.photo} alt={member.firstName} />}
                          <AvatarFallback>
                            {member.firstName[0]}{member.lastName[0]}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{member.firstName} {member.lastName}</p>
                        <p className="text-xs text-muted-foreground md:hidden">{member.phone}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{member.phone || '—'}</TableCell>
                      <TableCell className="hidden lg:table-cell">{member.email || '—'}</TableCell>
                      <TableCell className="hidden lg:table-cell">{member.department || '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            {member.type === 'personnel' ? 'Personnel' : 'Membre'}
                          </Badge>
                          <Badge variant={member.status === 'active' ? 'default' : 'secondary'}>
                            {member.status === 'active' ? 'Actif' : 'Inactif'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDrawer(member)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Voir le profil</TooltipContent>
                          </Tooltip>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDrawer(member)}>
                                <Eye className="h-4 w-4 mr-2" /> Voir le profil
                              </DropdownMenuItem>
                              {canEditMembers(auth.role) && (
                                <DropdownMenuItem onClick={() => handleOpenEdit(member)}>
                                  <Edit className="h-4 w-4 mr-2" /> Modifier
                                </DropdownMenuItem>
                              )}
                              {canEditMembers(auth.role) && (
                                <DropdownMenuItem onClick={() => handleToggleStatus(member)}>
                                  {member.status === 'active' ? 'Désactiver' : 'Réactiver'}
                                </DropdownMenuItem>
                              )}
                              {canDeleteMembers(auth.role) && (
                                <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(member.id)}>
                                  <Trash2 className="h-4 w-4 mr-2" /> Supprimer
                                </DropdownMenuItem>
                              )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} sur {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── Floating Selection Bar ─── */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-background border shadow-lg rounded-xl px-4 py-3 sm:px-6">
          <span className="text-sm font-medium whitespace-nowrap">
            {selectedIds.size} sélectionné(s)
          </span>
          <div className="w-px h-6 bg-border" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={batchLoading}
                className="gap-1.5 text-xs"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Changer le statut
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleBatchStatusChange('active')}>
                <UserCheck className="h-4 w-4 mr-2 text-emerald-600" />
                Marquer comme actif
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleBatchStatusChange('inactive')}>
                <UserX className="h-4 w-4 mr-2 text-rose-600" />
                Marquer comme inactif
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={batchLoading}
            className="gap-1.5 text-xs"
          >
            <Trash2 className="h-3.5 w-3.5" /> Supprimer la sélection
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la sélection</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer {selectedIds.size} membre(s) ? Cette action les marquera comme inactifs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchLoading}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatchDelete}
              disabled={batchLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {batchLoading ? 'Suppression...' : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── CSV Import Dialog ─── */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => { setImportDialogOpen(open); if (!open) { setImportFile(null); setDragOver(false) } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Importer des membres (CSV)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Dropzone */}
            <div
              className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-lg p-8 transition-colors cursor-pointer ${
                dragOver
                  ? 'border-primary bg-primary/5'
                  : importFile
                    ? 'border-green-500 bg-green-50/50 dark:bg-green-950/10'
                    : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className={`h-8 w-8 ${importFile ? 'text-green-600' : 'text-muted-foreground/50'}`} />
              {importFile ? (
                <div className="text-center">
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">{importFile.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(importFile.size / 1024).toFixed(1)} Ko — Cliquez pour changer
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm font-medium">Glissez un fichier CSV ici</p>
                  <p className="text-xs text-muted-foreground mt-1">ou cliquez pour sélectionner</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            {/* Template download link */}
            <div className="text-center">
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <FileDown className="h-4 w-4" />
                Télécharger le modèle CSV
              </button>
              <p className="text-xs text-muted-foreground mt-1">
                Colonnes : prenom, nom, email, telephone, adresse, departement, fonction, statut
              </p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button
              onClick={handleImport}
              disabled={importing || !importFile}
              className="gap-2"
            >
              {importing ? (
                <>
                  <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Import...
                </>
              ) : (
                <>
                  <FileSpreadsheet className="h-4 w-4" />
                  Importer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Register Link Dialog */}
      <Dialog open={registerLinkOpen} onOpenChange={setRegisterLinkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Lien d'inscription de l'église
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Partagez ce lien unique pour que membres et personnel s'inscrivent
             {" "}eux-mêmes dans votre système. Ils pourront téléverser leur photo et
              seront directement ajoutés à votre liste de membres.
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={registerLink}
                placeholder="Génération du lien..."
                className="font-mono text-xs"
              />
            </div>
            <Button onClick={handleCopyRegisterLink} className="w-full gap-2">
              <Link2 className="h-4 w-4" />
              Copier le lien
            </Button>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Fermer</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMember ? 'Modifier le membre' : 'Ajouter un membre'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Photo */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                {form.photo && <AvatarImage src={form.photo} />}
                <AvatarFallback className="text-lg">
                  {form.firstName?.[0] || '?'}{form.lastName?.[0] || ''}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <label className="cursor-pointer">
                  <div className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <Camera className="h-4 w-4" /> Changer la photo
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
                {uploading && <p className="text-xs text-muted-foreground">Téléchargement...</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Prénom *</Label>
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="Prénom" />
              </div>
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Nom" />
              </div>
            </div>

            {/* Type: Membre / Personnel */}
            <div className="space-y-2">
              <Label>Type de registre</Label>
              <RadioGroup
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as 'member' | 'personnel' })}
                className="grid grid-cols-2 gap-3"
              >
                <label
                  className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${
                    form.type === 'member'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/40'
                  }`}
                >
                  <RadioGroupItem value="member" id="type-member" />
                  <div>
                    <p className="text-sm font-medium">Membre</p>
                    <p className="text-xs text-muted-foreground">Chorale, accueil, etc.</p>
                  </div>
                </label>
                <label
                  className={`flex items-center gap-2 rounded-lg border p-3 cursor-pointer transition-colors ${
                    form.type === 'personnel'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/40'
                  }`}
                >
                  <RadioGroupItem value="personnel" id="type-personnel" />
                  <div>
                    <p className="text-sm font-medium">Personnel</p>
                    <p className="text-xs text-muted-foreground">Salarié (salaire, jamais sur carte)</p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+243 ..." />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemple.com" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Adresse</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Adresse complète" />
            </div>
            <div className="space-y-2">
              <Label>{form.type === 'personnel' ? 'Salaire (USD) — optionnel, jamais sur la carte' : 'Département'}</Label>
              {form.type === 'personnel' ? (
                <Input
                  value={form.salary}
                  onChange={(e) => setForm({ ...form, salary: e.target.value })}
                  placeholder="Ex: 500"
                  type="number"
                  min="0"
                />
              ) : (
                <>
                  <Input
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    placeholder="Département"
                    list="department-list"
                  />
                  <datalist id="department-list">
                    {departments.map((d) => (
                      <option key={d.name} value={d.name} />
                    ))}
                  </datalist>
                  {departments.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Départements existants : {departments.slice(0, 6).map((d) => d.name).join(', ')}{departments.length > 6 ? '…' : ''}
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fonction</Label>
                <Input value={form.function} onChange={(e) => setForm({ ...form, 'function': e.target.value })} placeholder="Fonction" />
              </div>
              {form.type === 'personnel' && (
                <div className="space-y-2">
                  <Label>Département (optionnel)</Label>
                  <Input
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    placeholder="Département"
                    list="department-list-2"
                  />
                  <datalist id="department-list-2">
                    {departments.map((d) => (
                      <option key={d.name} value={d.name} />
                    ))}
                  </datalist>
                </div>
              )}
            </div>

            {/* Contact d'urgence */}
            <div className="rounded-lg border bg-muted/10 p-3 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Contact en cas d'urgence</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Nom du contact</Label>
                  <Input value={form.emergencyContactName} onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })} placeholder="Nom" />
                </div>
                <div className="space-y-2">
                  <Label>Téléphone</Label>
                  <Input value={form.emergencyContactPhone} onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })} placeholder="+243 ..." />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Annuler</Button>
            </DialogClose>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Enregistrement...' : editingMember ? 'Modifier' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Member Detail Drawer ─── */}
      <MemberDetailDrawer
        open={drawerOpen}
        onOpenChange={(open) => { if (!open) closeDrawer() }}
        member={drawerMember}
        token={auth.token ?? ''}
      />
    </div>
    </TooltipProvider>
  )
}