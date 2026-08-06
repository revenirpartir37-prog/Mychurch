import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

// POST /api/seed — Populate demo data for the test church
export async function POST() {
  try {
    const church = await db.church.findFirst({
      where: { email: 'grace@eglise.com' },
    })

    if (!church) {
      return NextResponse.json({ error: 'Test church not found' }, { status: 404 })
    }

    const churchId = church.id
    const now = new Date()

    // ── Members (12 members) ──
    const memberNames = [
      { firstName: 'Jean-Pierre', lastName: 'Mukendi', department: 'Chorale', function: 'Choriste' },
      { firstName: 'Marie', lastName: 'Nsimba', department: 'Femmes', function: 'Responsable' },
      { firstName: 'Emmanuel', lastName: 'Kabongo', department: 'Diaconat', function: 'Diacre' },
      { firstName: 'Grace', lastName: 'Tshimanga', department: 'Jeunesse', function: 'Membre' },
      { firstName: 'Patrice', lastName: 'Lumumba', department: 'Enseignement', function: 'Enseignant' },
      { firstName: 'Rachel', lastName: 'Mbuyi', department: 'Femmes', function: 'Trésorière' },
      { firstName: 'David', lastName: 'Ilunga', department: 'Chorale', function: 'Directeur' },
      { firstName: 'Esther', lastName: 'Kasongo', department: 'Accueil', function: 'Responsable' },
      { firstName: 'Samuel', lastName: 'Ngoy', department: 'Médias', function: 'Technicien' },
      { firstName: 'Naomi', lastName: 'Kalala', department: 'Jeunesse', function: 'Coordinatrice' },
      { firstName: 'Joel', lastName: 'Mbala', department: 'Intercession', function: 'Intercesseur' },
      { firstName: 'Béatrice', lastName: 'Lukusa', department: 'Enseignement', function: 'Enseignante' },
    ]

    const createdMembers: Awaited<ReturnType<typeof db.member.create>>[] = []
    for (const m of memberNames) {
      const joinDate = new Date(now)
      joinDate.setMonth(joinDate.getMonth() - Math.floor(Math.random() * 12))
      const member = await db.member.create({
        data: {
          churchId,
          firstName: m.firstName,
          lastName: m.lastName,
          email: `${m.firstName.toLowerCase()}.${m.lastName.toLowerCase()}@example.com`,
          phone: `+243${Math.floor(800000000 + Math.random() * 199999999)}`,
          address: `Kinshasa, Zone ${Math.floor(Math.random() * 10) + 1}`,
          department: m.department,
          function: m.function,
          status: Math.random() > 0.15 ? 'active' : 'inactive',
          joinDate,
        },
      })
      createdMembers.push(member)
    }

    // ── Events (6 events — past + upcoming) ──
    const eventsData = [
      { title: 'Culte de Dimanche', type: 'culte', daysAgo: 7, daysOffset: 0 },
      { title: 'Réunion de Prière', type: 'reunion', daysAgo: 5, daysOffset: 0 },
      { title: 'Séminaire de Formation', type: 'seminar', daysAgo: 14, daysOffset: 0 },
      { title: 'Culte Spécial Thanksgiving', type: 'culte', daysAgo: 21, daysOffset: 0 },
      { title: 'Conférence des Jeunes', type: 'conference', daysAgo: 0, daysOffset: 3 },
      { title: 'Culte de Noël', type: 'culte', daysAgo: 0, daysOffset: 14 },
    ]

    const createdEvents: Awaited<ReturnType<typeof db.event.create>>[] = []
    for (const ev of eventsData) {
      const startDate = new Date(now)
      if (ev.daysAgo > 0) {
        startDate.setDate(startDate.getDate() - ev.daysAgo)
      } else {
        startDate.setDate(startDate.getDate() + ev.daysOffset)
      }
      startDate.setHours(9 + Math.floor(Math.random() * 3), 0, 0, 0)

      const endDate = new Date(startDate)
      endDate.setHours(startDate.getHours() + 2)

      const event = await db.event.create({
        data: {
          churchId,
          title: ev.title,
          type: ev.type,
          description: `Événement ${ev.type} planifié pour la communauté`,
          startDate,
          endDate,
          location: 'Salle principale',
          createdBy: 'cmqsnh60n0002m587ms5y90n3',
        },
      })
      createdEvents.push(event)
    }

    // ── Transactions (20 transactions over 6 months) ──
    const revenueCategories = ['Dîme', 'Offrande', 'Don', 'Contribution']
    const expenseCategories = ['Salaire', 'Électricité', 'Eau', 'Matériel', 'Location', 'Transport']

    for (let i = 0; i < 20; i++) {
      const isRevenue = Math.random() > 0.35
      const type = isRevenue ? 'revenue' : 'expense'
      const categories = isRevenue ? revenueCategories : expenseCategories
      const category = categories[Math.floor(Math.random() * categories.length)]
      const amount = isRevenue
        ? Math.round((50 + Math.random() * 450) * 100) / 100
        : Math.round((20 + Math.random() * 200) * 100) / 100

      const date = new Date(now)
      date.setDate(date.getDate() - Math.floor(Math.random() * 180))

      await db.transaction.create({
        data: {
          churchId,
          type,
          category,
          amount,
          currency: 'USD',
          location: Math.random() > 0.5 ? 'cash' : 'bank',
          description: `${category} — ${date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
          date,
          memberId: Math.random() > 0.4 ? createdMembers[Math.floor(Math.random() * createdMembers.length)].id : null,
          createdBy: 'cmqsnh60n0002m587ms5y90n3',
        },
      })
    }

    // ── Attendance (for past events, 5-12 members each) ──
    const pastEvents = createdEvents.filter(e => new Date(e.startDate) < now)
    for (const event of pastEvents) {
      const numPresent = 5 + Math.floor(Math.random() * 8)
      const shuffled = [...createdMembers].sort(() => Math.random() - 0.5)
      for (let i = 0; i < numPresent && i < shuffled.length; i++) {
        const status = Math.random() > 0.15 ? 'present' : (Math.random() > 0.5 ? 'late' : 'absent')
        await db.attendance.create({
          data: {
            churchId,
            eventId: event.id,
            memberId: shuffled[i].id,
            status,
            date: event.startDate,
            notes: status === 'late' ? 'En retard de 15 min' : undefined,
          },
        })
      }
    }

    // ── Notifications (5) ──
    const notifications = [
      { title: 'Bienvenue sur MYCHURCH', message: 'Votre église a été configurée avec succès. Découvrez toutes les fonctionnalités !', type: 'info' },
      { title: 'Période d\'essai active', message: 'Vous avez 30 jours d\'essai gratuit. Passez à un plan payant pour continuer.', type: 'warning' },
      { title: 'Nouveau membre ajouté', message: 'Jean-Pierre Mukendi a rejoint la communauté.', type: 'success' },
      { title: 'Rappel', message: 'N\'oubliez pas de planifier le culte de cette semaine.', type: 'info' },
      { title: 'Offrande enregistrée', message: 'Une offrande de 250 $ a été enregistrée.', type: 'success' },
    ]

    for (const n of notifications) {
      await db.notification.create({
        data: {
          churchId,
          userId: 'cmqsnh60n0002m587ms5y90n3',
          title: n.title,
          message: n.message,
          type: n.type,
          isRead: Math.random() > 0.6,
        },
      })
    }

    const summary = {
      members: createdMembers.length,
      events: createdEvents.length,
      transactions: 20,
      attendance: 'populated for past events',
      notifications: notifications.length,
    }

    return NextResponse.json({ success: true, message: 'Données de démonstration créées', summary })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}