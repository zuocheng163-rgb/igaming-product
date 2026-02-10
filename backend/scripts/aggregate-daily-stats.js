// Supabase Edge Function: aggregate-daily-stats
// To be deployed as a cron job

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    console.log(`Aggregating stats for ${dateStr}`);

    try {
        // 1. Fetch all transactions for yesterday
        const { data: txs, error: txError } = await supabase
            .from('transactions')
            .select('*')
            .gte('created_at', `${dateStr}T00:00:00Z`)
            .lt('created_at', `${dateStr}T23:59:59Z`);

        if (txError) throw txError;

        // 2. Aggregate by operator
        const statsMap = new Map();

        txs.forEach(tx => {
            const opId = tx.operator_id;
            if (!statsMap.has(opId)) {
                statsMap.set(opId, { bets: 0, wins: 0, count: 0 });
            }
            const s = statsMap.get(opId);
            if (tx.type === 'debit') s.bets += Number(tx.amount);
            if (tx.type === 'credit') s.wins += Number(tx.amount);
            s.count++;
        });

        // 3. Upsert into daily_stats
        for (const [opId, s] of statsMap.entries()) {
            const ggr = s.bets - s.wins;
            const { error: upsertError } = await supabase
                .from('daily_stats')
                .upsert({
                    operator_id: opId,
                    date: dateStr,
                    total_bets: s.bets,
                    total_wins: s.wins,
                    ggr: ggr,
                    ngr: ggr * 0.9, // Simplified NGR
                    active_players: 0, // Would need user session query
                    approval_rate: 100 // Placeholder
                }, { onConflict: 'operator_id, date' });

            if (upsertError) console.error(`Failed to upsert for ${opId}:`, upsertError);
        }

        return new Response(JSON.stringify({ success: true, date: dateStr }), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
})
