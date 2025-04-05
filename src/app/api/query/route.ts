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

        const response = {
            response: `Heres a mock reply for your prompt: ${prompt}`,
            sources: [
                {
                    name: "India Code",
                    tag: "official",
                    excerpt: "Mock excerpt from law.",
                    sourcelink: "https://indiacode.nic.in"
                }, {
                    name: "Tax Code",
                    tag: "official",
                    excerpt: "Mock excerpt v2",
                    sourcelink: "https://indiataxcode.nic.in"
                }
            ]
        };

        return NextResponse.json(response, { status: 200 });
    } catch (err) {
        console.error('Server error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}