import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const body = await request.json()
    const { token } = body

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'Token não fornecido.' },
        { status: 400 }
      )
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(token)) {
      return NextResponse.json(
        { valid: false, error: 'Token inválido.' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Look up the token securely bypassing RLS
    const { data: tokenData, error: tokenError } = await supabase
      .rpc('get_token_info', { p_token: token })
      .single()

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { valid: false, error: 'Token não encontrado. Verifique se o link está correto.' },
        { status: 404 }
      )
    }

    // Check if token has been used
    if (tokenData.is_used) {
      return NextResponse.json(
        { valid: false, error: 'Este token já foi utilizado para votar.', code: 'TOKEN_USED' },
        { status: 403 }
      )
    }

    // Check if token is expired
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return NextResponse.json(
        { valid: false, error: 'Este token expirou.', code: 'TOKEN_EXPIRED' },
        { status: 403 }
      )
    }

    // Get session info
    const { data: sessionData, error: sessionError } = await supabase
      .from('voting_sessions')
      .select('id, title, description, is_active')
      .eq('id', tokenData.session_id)
      .single()

    if (sessionError || !sessionData) {
      return NextResponse.json(
        { valid: false, error: 'Sessão de votação não encontrada.' },
        { status: 404 }
      )
    }

    // Check if session is active
    if (!sessionData.is_active) {
      return NextResponse.json(
        { valid: false, error: 'Esta sessão de votação não está ativa.', code: 'SESSION_INACTIVE' },
        { status: 403 }
      )
    }

    // Get categories with options, ordered by display_order
    const { data: categories, error: catError } = await supabase
      .from('voting_categories')
      .select(`
        id,
        name,
        description,
        display_order,
        voting_options (
          id,
          name,
          description,
          display_order
        )
      `)
      .eq('session_id', sessionData.id)
      .order('display_order', { ascending: true })

    if (catError) {
      return NextResponse.json(
        { valid: false, error: 'Erro ao carregar categorias de votação.' },
        { status: 500 }
      )
    }

    // Sort options within each category
    const sortedCategories = (categories || []).map(cat => ({
      ...cat,
      voting_options: (cat.voting_options || []).sort(
        (a, b) => (a.display_order || 0) - (b.display_order || 0)
      ),
    }))

    // Check which categories already have votes (via vote_receipts)
    const { data: receipts } = await supabase
      .from('vote_receipts')
      .select('category_id')
      .eq('token_id', tokenData.id)

    const votedCategoryIds = (receipts || []).map(r => r.category_id)

    return NextResponse.json({
      valid: true,
      session: {
        id: sessionData.id,
        title: sessionData.title,
        description: sessionData.description,
      },
      categories: sortedCategories,
      votedCategoryIds,
    })
  } catch (err) {
    console.error('Token validation error:', err)
    return NextResponse.json(
      { valid: false, error: 'Erro interno do servidor.' },
      { status: 500 }
    )
  }
}
