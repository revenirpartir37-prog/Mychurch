import { verifyRefreshToken, generateAccessToken, generateRefreshToken } from '@/lib/auth'
import { db } from '@/lib/db'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const refreshToken = body?.refreshToken
    if (!refreshToken || typeof refreshToken !== 'string') {
      return Response.json({ error: 'Refresh token required' }, { status: 400 })
    }

    const payload = await verifyRefreshToken(refreshToken)
    if (!payload?.userId) {
      return Response.json({ error: 'Invalid refresh token' }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, churchId: true, email: true, role: true, firstName: true, lastName: true, isActive: true },
    })
    if (!user || !user.isActive) {
      return Response.json({ error: 'User not found or inactive' }, { status: 401 })
    }

    const church = await db.church.findUnique({
      where: { id: user.churchId },
      select: { id: true, name: true },
    })
    if (!church) {
      return Response.json({ error: 'Church not found' }, { status: 401 })
    }

    const newAccessToken = await generateAccessToken({
      userId: user.id,
      churchId: user.churchId,
      email: user.email,
      role: user.role,
      churchName: church.name,
    })

    const newRefreshToken = await generateRefreshToken(user.id)

    return Response.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    })
  } catch (error) {
    console.error('Refresh token error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
