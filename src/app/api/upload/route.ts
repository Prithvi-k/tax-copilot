import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { promises as fs } from 'fs';

export const config = {
    api: {
        bodyParser: false,
    },
};

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (file.type !== 'application/pdf') {
            return NextResponse.json({ error: 'Only PDF files allowed' }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const dir = path.join(process.cwd(), 'data/user_docs');
        await fs.mkdir(dir, { recursive: true });

        const filePath = path.join(dir, file.name);
        await fs.writeFile(filePath, buffer);

        const { error: dbError } = await supabase.from('uploaded_files').insert([
            {
                filename: file.name,
                filesize: file.size,
                status: 'uploaded',
            }
        ]);

        if (dbError) {
            console.error('[Supabase] Insert error:', dbError);
            return NextResponse.json({ error: 'Upload succeeded but DB insert failed' }, { status: 500 });
        }

        return NextResponse.json({ message: 'File uploaded successfully' });
    } catch (err) {
        console.error('[UPLOAD] Unexpected error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
