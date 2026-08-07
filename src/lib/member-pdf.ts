import { jsPDF } from 'jspdf'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export interface MemberPdfData {
  firstName: string
  lastName: string
  type?: string | null
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

function loadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const size = 256
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('canvas'))
        ctx.drawImage(img, 0, 0, size, size)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => reject(new Error('load error'))
    img.src = url
  })
}

function getInitials(m: MemberPdfData): string {
  return `${m.firstName.charAt(0)}${m.lastName.charAt(0)}`.toUpperCase()
}

function getInitialsColor(m: MemberPdfData): [number, number, number] {
  const palette: [number, number, number][] = [
    [225, 29, 72], [217, 119, 6], [5, 150, 105], [6, 182, 212],
    [139, 92, 246], [234, 88, 12], [13, 148, 136], [219, 39, 119],
    [99, 102, 241], [101, 163, 13], [192, 38, 211], [14, 165, 233],
    [220, 38, 38], [22, 163, 74], [202, 138, 4], [168, 85, 247],
    [37, 99, 235], [120, 113, 108], [101, 163, 13], [244, 63, 94],
  ]
  const code = (m.firstName + m.lastName).charAt(0).toUpperCase().charCodeAt(0)
  return palette[code % palette.length]
}

export async function generateMemberPdf(
  member: MemberPdfData,
  church: { name: string; logo?: string | null },
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 15

  // ── Header band ──
  doc.setFillColor(30, 64, 175)
  doc.rect(0, 0, pageW, 30, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(church.name || 'MYCHURCH', margin, 14)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Fiche membre — MYCHURCH', margin, 20)
  doc.text('Créé par Henock Aduma', pageW - margin, 20, { align: 'right' })

  // ── Logo (if any) ──
  if (church.logo) {
    try {
      const logoData = await loadImage(church.logo)
      doc.addImage(logoData, 'JPEG', pageW - 24, 6, 9, 9)
    } catch {
      // ignore logo failures
    }
  }

  // ── Identity card ──
  const startY = 42
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(margin, startY, pageW - margin * 2, 55, 4, 4, 'FD')

  // Photo circle
  const photoX = margin + 8
  const photoY = startY + 8
  const photoR = 19
  doc.setDrawColor(255, 255, 255)
  doc.setFillColor(226, 232, 240)
  doc.circle(photoX + photoR, photoY + photoR, photoR, 'FD')
  if (member.photo) {
    try {
      const photoData = await loadImage(member.photo)
      doc.addImage(photoData, 'JPEG', photoX, photoY, photoR * 2, photoR * 2)
      doc.setFillColor(30, 64, 175)
      doc.setDrawColor(255, 255, 255)
      doc.setLineWidth(1.2)
      doc.circle(photoX + photoR, photoY + photoR, photoR, 'S')
    } catch {
      drawInitials(doc, member, photoX, photoY, photoR * 2)
    }
  } else {
    drawInitials(doc, member, photoX, photoY, photoR * 2)
  }

  // Name + badges
  const textX = photoX + photoR * 2 + 10
  doc.setTextColor(15, 23, 42)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(`${member.firstName} ${member.lastName}`, textX, startY + 14)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(member.type === 'personnel' ? 'Personnel' : 'Membre', textX, startY + 22)
  if (member.status) {
    doc.text(member.status === 'active' ? 'Statut : Actif' : 'Statut : Inactif', textX, startY + 28)
  }
  if (member.function) {
    doc.text(`Fonction : ${member.function}`, textX, startY + 34)
  }

  // ── Details ──
  let y = startY + 70
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(30, 64, 175)
  doc.text('Informations', margin, y)
  y += 2
  doc.setDrawColor(30, 64, 175)
  doc.setLineWidth(0.4)
  doc.line(margin, y, pageW - margin, y)
  y += 7

  const rows: [string, string][] = [
    ['Téléphone', member.phone || '—'],
    ['Email', member.email || '—'],
    ['Adresse', member.address || '—'],
    ['Département', member.department || '—'],
    ["Date d'inscription", member.joinDate ? format(new Date(member.joinDate), 'dd MMMM yyyy', { locale: fr }) : '—'],
  ]
  if (member.type === 'personnel' && member.salary != null) {
    rows.push(['Salaire', `${member.salary.toLocaleString('fr-FR')} USD`])
  }
  if (member.emergencyContactName || member.emergencyContactPhone) {
    rows.push([
      "Contact d'urgence",
      [member.emergencyContactName, member.emergencyContactPhone].filter(Boolean).join(' · '),
    ])
  }

  doc.setFontSize(10)
  let rowY = y
  rows.forEach(([label, value], i) => {
    rowY = y + i * 8
    if (rowY > pageH - 30) {
      doc.addPage()
      doc.setFontSize(10)
      rowY = 20
      y = 20 - i * 8
    }
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(71, 85, 105)
    doc.text(label, margin, rowY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(15, 23, 42)
    const labelW = doc.getTextWidth(label)
    doc.text(value, margin + Math.max(labelW, 45) + 6, rowY)
  })

  // ── Footer ──
  const footerY = pageH - 14
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.3)
  doc.line(margin, footerY - 6, pageW - margin, footerY - 6)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text(`Généré le ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: fr })} — MYCHURCH`, margin, footerY)
  doc.text('Created by Henock Aduma', pageW - margin, footerY, { align: 'right' })

  doc.save(`fiche_${member.firstName}_${member.lastName}.pdf`)
}

function drawInitials(doc: jsPDF, member: MemberPdfData, x: number, y: number, size: number) {
  const [r, g, b] = getInitialsColor(member)
  doc.setFillColor(r, g, b)
  doc.circle(x + size / 2, y + size / 2, size / 2, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(size * 0.4)
  doc.setFont('helvetica', 'bold')
  doc.text(getInitials(member), x + size / 2, y + size / 2 + size * 0.14, { align: 'center' })
}
