// src/app/api/delete/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
    try {
        const { id, filename } = await req.json();

        // 1. Delete the file from disk
        const filePath = path.join(process.cwd(), 'data/user_docs', filename);
        await fs.unlink(filePath);

        // 2. Delete metadata from Supabase
        const { error } = await supabase
            .from('uploaded_files')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Supabase deletion error:', error);
            return NextResponse.json({ error: 'Supabase deletion failed.' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Delete API error:', err);
        return NextResponse.json({ error: 'File deletion failed.' }, { status: 500 });
    }
}
