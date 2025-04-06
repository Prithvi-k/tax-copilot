import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';


const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);


export async function POST(req: NextRequest) {
    try {
        if (req.method !== 'POST') {
            return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
        }

        const { prompt, user_name } = await req.json();

        if (!prompt || !user_name) {
            return NextResponse.json({ error: 'Prompt and user_name are required' }, { status: 400 });
        }

        const { data, error } = await supabase.from('queries').insert([
            {
                user_prompt: prompt,
                user_name
            }
        ]);


        if (error) {
            console.error('Supabase error:', error);
            return NextResponse.json({ error: 'Failed to save query' }, { status: 500 });
        }

        // console.log('DEBUG', prompt, user_name);

        const response = await fetch('http://localhost:8000/api/query', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt, user_name }),
        });

        const responseData = await response.json();

        console.log('Response from external API:', responseData);

        return NextResponse.json(responseData, { status: 200 });
    } catch (err) {
        console.error('Server error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}