import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, createAuthResponse } from '@/lib/auth-middleware'
import { prisma } from '@/lib/db'

export async function DELETE(request: NextRequest) {
  try {
    // 使用认证中间件验证
    const authResult = await verifyAuth(request)
    if (!authResult.success) {
      return createAuthResponse(authResult.error || '认证失败', 401)
    }

    const body = await request.json()
    const { id, ids } = body

    // 兼容单条删除（id）和批量删除（ids）
    const targetIds: number[] = ids
      ? ids.map((i: number) => parseInt(String(i)))
      : id
        ? [parseInt(String(id))]
        : []

    if (targetIds.length === 0) {
      return NextResponse.json(
        { success: false, message: '激活码ID不能为空' },
        { status: 400 }
      )
    }

    // 检查所有激活码是否存在
    const existingCodes = await prisma.activationCode.findMany({
      where: { id: { in: targetIds } }
    })

    if (existingCodes.length === 0) {
      return NextResponse.json(
        { success: false, message: '激活码不存在' },
        { status: 404 }
      )
    }

    const foundIds = existingCodes.map(code => code.id)

    // 删除激活码
    const result = await prisma.activationCode.deleteMany({
      where: { id: { in: foundIds } }
    })

    return NextResponse.json({
      success: true,
      message: targetIds.length > 1
        ? `成功删除 ${result.count} 个激活码`
        : '激活码删除成功',
      deletedCount: result.count
    })

  } catch (error) {
    console.error('删除激活码时发生错误:', error)
    return NextResponse.json(
      { success: false, message: '服务器内部错误' },
      { status: 500 }
    )
  }
}
