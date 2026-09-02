// View types for SPA navigation
export type AppView =
  | 'landing'
  | 'login'
  | 'register'
  | 'otp-verify'
  | 'forgot-password'
  | 'dashboard'
  | 'members'
  | 'member-cards'
  | 'finances'
  | 'debts'
  | 'events'
  | 'attendance'
  | 'messages'
  | 'reports'
  | 'notifications'
  | 'settings'
  | 'archives'
  | 'users-management'
  | 'network'
  | 'subscription'
  | 'about'

// Application version
export const APP_VERSION = '0.3.0'

// User roles
export type UserRole = 'admin' | 'treasurer' | 'secretary' | 'reader'

// Transaction types
export type TransactionType = 'revenue' | 'expense'

export type RevenueCategory = 'offering' | 'tithe' | 'donation' | 'contribution' | 'other'

export type ExpenseCategory = 'salary' | 'water' | 'electricity' | 'internet' | 'maintenance' | 'transport' | 'equipment' | 'repair' | 'food' | 'general'

export type Currency = 'USD' | 'FC' | 'EUR'

export type TransactionLocation = 'bank' | 'cash'

export type EventType = 'culte' | 'reunion' | 'seminar' | 'conference' | 'formation'

export type AttendanceStatus = 'present' | 'absent' | 'late'

export type MessageFolder = 'inbox' | 'sent' | 'archived'

// Role labels (French)
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrateur',
  treasurer: 'Trésorier',
  secretary: 'Secrétaire',
  reader: 'Lecteur',
}

// Revenue category labels
export const REVENUE_LABELS: Record<RevenueCategory, string> = {
  offering: 'Offrandes',
  tithe: 'Dîmes',
  donation: 'Dons',
  contribution: 'Contributions',
  other: 'Divers',
}

// Expense category labels
export const EXPENSE_LABELS: Record<ExpenseCategory, string> = {
  salary: 'Salaires',
  water: 'Eau',
  electricity: 'Électricité',
  internet: 'Internet',
  maintenance: 'Maintenance',
  transport: 'Transport',
  equipment: 'Équipement',
  repair: 'Réparations',
  food: 'Nourriture',
  general: 'Général',
}

// Event type labels
export const EVENT_LABELS: Record<EventType, string> = {
  culte: 'Cultes',
  reunion: 'Réunions',
  seminar: 'Séminaires',
  conference: 'Conférences',
  formation: 'Formations',
}

// Currency labels
export const CURRENCY_LABELS: Record<Currency, string> = {
  USD: 'USD ($)',
  FC: 'FC',
  EUR: 'EUR (€)',
}

// Creator signature
export const CREATOR = 'Created by Henock Aduma'

// Debt status labels
export const DEBT_STATUS_LABELS: Record<string, string> = {
  pending: 'En attente d\'approbation',
  approved: 'Approuvé',
  rejected: 'Rejeté',
  paid: 'Remboursé',
  cancelled: 'Annulé',
}