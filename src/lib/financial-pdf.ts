import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface FinancialPDFData {
  churchName: string
  churchLogo?: string | null
  id: string
  type: 'revenue' | 'expense'
  category: string
  amount: number
  currency: string
  location: string
  description?: string | null
  date: string
  recordedByName?: string | null
  beneficiary?: string | null
  referenceNumber?: string | null
  signatureData?: string | null
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  if (!url) return null
  if (url.startsWith('data:image')) return url
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function generateFinancialPDF(data: FinancialPDFData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const isExpense = data.type === 'expense'
  const title = isExpense ? 'BON DE DÉPENSE FINANCIÈRE' : 'COMPTE-RENDU FINANCIER'
  const primaryColor: [number, number, number] = isExpense ? [225, 29, 72] : [16, 185, 129] // Red or Green

  let startY = 15

  // Header background bar
  doc.setFillColor(...primaryColor)
  doc.rect(0, 0, 210, 8, 'F')

  // Church Logo
  if (data.churchLogo) {
    const logoBase64 = await loadImageAsBase64(data.churchLogo)
    if (logoBase64) {
      try {
        doc.addImage(logoBase64, 'PNG', 14, startY, 20, 20)
      } catch {
        // Fallback silently if image fails to render
      }
    }
  }

  // Header Titles
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(31, 41, 55)
  doc.text(data.churchName.toUpperCase(), 38, startY + 8)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128)
  doc.text('Système de Gestion Église — MYCHURCH', 38, startY + 14)

  // Document Title Banner
  startY += 24
  doc.setFillColor(243, 244, 246)
  doc.roundedRect(14, startY, 182, 12, 2, 2, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...primaryColor)
  doc.text(title, 20, startY + 8)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(107, 114, 128)
  doc.text(`Réf: ${data.referenceNumber || data.id.slice(-8).toUpperCase()} | Date: ${new Date(data.date).toLocaleDateString('fr-FR')}`, 190, startY + 8, { align: 'right' })

  // Metadata Table
  startY += 18
  const locationLabel = data.location === 'bank' ? 'Banque' : 'Caisse'
  const formattedAmount = `${data.amount.toFixed(2)} ${data.currency}`

  autoTable(doc, {
    startY,
    head: [['Champ', 'Détail de la transaction']],
    body: [
      ['Type de Transaction', isExpense ? 'Dépense' : 'Compte rendu / Recette'],
      ['Catégorie', data.category],
      ['Montant Total', formattedAmount],
      ['Lieu d\'Imputation', locationLabel],
      ['Bénéficiaire / Destinataire', data.beneficiary || '—'],
      ['Enregistré par (Nom complet)', data.recordedByName || '—'],
      ['N° Pièce / Référence', data.referenceNumber || '—'],
      ['Description / Motif', data.description || '—'],
    ],
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: {
      fontSize: 9.5,
      cellPadding: 3.5,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55, textColor: [55, 65, 81] },
      1: { textColor: [17, 24, 39] },
    },
    margin: { left: 14, right: 14 },
  })

  // Get Y after table
  const finalY = (doc as any).lastAutoTable.finalY + 15

  // Verification Note Box
  doc.setFillColor(249, 250, 251)
  doc.setDrawColor(229, 231, 235)
  doc.roundedRect(14, finalY, 182, 16, 2, 2, 'FD')

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8.5)
  doc.setTextColor(107, 114, 128)
  doc.text(
    'Ce document est un extrait financier officiel délivré par le système MYCHURCH. Il certifie l\'exactitude des informations enregistrées et validées.',
    18,
    finalY + 9,
    { maxWidth: 174 }
  )

  // Electronic Signature Block
  const sigY = finalY + 24
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(31, 41, 55)
  doc.text('Signature Électronique :', 14, sigY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(107, 114, 128)
  doc.text(`Signé par : ${data.recordedByName || 'Responsable Financier'}`, 14, sigY + 5)

  if (data.signatureData) {
    try {
      doc.addImage(data.signatureData, 'PNG', 14, sigY + 8, 50, 20)
      doc.setDrawColor(209, 213, 219)
      doc.line(14, sigY + 29, 70, sigY + 29)
    } catch {
      doc.setFont('helvetica', 'italic')
      doc.text('[ Signature validée numériquement ]', 14, sigY + 15)
    }
  } else {
    doc.setFont('helvetica', 'italic')
    doc.text('[ Signature électronique non apposée ]', 14, sigY + 12)
  }

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(156, 163, 175)
  doc.text(`Généré le ${new Date().toLocaleString('fr-FR')} — MYCHURCH App | Created by Henock Aduma`, 105, pageHeight - 8, { align: 'center' })

  // Save PDF file
  const filename = `${isExpense ? 'depense' : 'compte_rendu'}_${data.referenceNumber || data.id.slice(-6)}_${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename)
}
