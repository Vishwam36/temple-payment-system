import { createServerClient, createAdminServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request) {
    try {
        const supabase = await createServerClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const admin = createAdminServerClient()

        const { searchParams } = new URL(request.url)
        const accountType = searchParams.get('type') // Filters out 'receiver' vs 'sender' formats

        let query = admin
            .from('frequently_used_accounts')
            .select('id, label, account_no, ifsc_code, account_holder, account_type, department')
            .order('label', { ascending: true })

        if (accountType) {
            query = query.eq('account_type', accountType)
        }

        const { data, error } = await query

        if (error) throw error

        return NextResponse.json({ presets: data }, { status: 200 })
    } catch (error) {
        console.error('Preset accounts fetch error:', error)
        return NextResponse.json({ error: 'Failed to retrieve ledger data templates' }, { status: 500 })
    }
}