// src/app/admin/page.tsx
'use client';
import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import relativeTime from "dayjs/plugin/relativeTime";
import { Trash2 } from "lucide-react";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface UserQuery {
    user_id: string;
    user_name: string;
    // department: string;
    user_prompt: string;
    created_at: string;
}

interface Document {
    id: string;
    filename: string;
    upload_time: string;
    filesize: number;
    status: 'uploaded' | 'processing' | 'ready' | 'error';
}


export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState<'queries' | 'documents'>('queries');
    const [dragActive, setDragActive] = useState(false);
    const [queries, setQueries] = useState<UserQuery[]>([]);
    const [documents, setDocuments] = useState<Document[]>([]);

    const fetchDocuments = async () => {
        const { data, error } = await supabase
            .from('uploaded_files')
            .select('*')
            .order('upload_time', { ascending: false });
        if (error) {
            console.error("Error fetching documents:", error);
        } else {
            setDocuments(data as Document[]);
        }
    };


    useEffect(() => {
        const fetchQueries = async () => {
            const { data, error } = await supabase
                .from('queries')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) {
                console.error("Error fetching queries:", error);
            } else {
                setQueries(data);
            }
        };

        if (activeTab === 'queries') {
            fetchQueries();
        } else if (activeTab === 'documents') {
            fetchDocuments();
        }
    }, [activeTab]);


    // Sample data
    // const recentQueries: UserQuery[] = [
    //     {
    //         user_id: "U123",
    //         user_name: "John Doe",
    //         user_prompt: "What are the new tax implications for remote workers?",
    //         timestamp: "2024-02-23 14:30",
    //         department: "Finance"
    //     },
    //     {
    //         user_id: "U124",
    //         user_name: "Jane Smith",
    //         user_prompt: "How do we handle international client payments?",
    //         timestamp: "2024-02-23 14:15",
    //         department: "Sales"
    //     }
    // ];

    // const documents: Document[] = [
    //     {
    //         id: "D1",
    //         filename: "Internal_Tax_Guidelines_2024.pdf",
    //         uploadedBy: "Admin",
    //         upload_time: "2024-02-22",
    //         filesize: "2.4 MB",
    //         status: "ready"
    //     },
    //     {
    //         id: "D2",
    //         filename: "Client_Confidential_Procedures.docx",
    //         uploadedBy: "Admin",
    //         upload_time: "2024-02-21",
    //         filesize: "1.8 MB",
    //         status: "processing"
    //     }
    // ];

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        const files = Array.from(e.dataTransfer.files);
        // Handle file upload logic here
        console.log("Files to upload:", files);
    };

    const handleDelete = async (id: string) => {
        const doc = documents.find(d => d.id === id);
        if (!doc) return;

        const confirm = window.confirm(`Delete "${doc.filename}"?`);
        if (!confirm) return;

        try {
            const res = await fetch('/api/delete', {
                method: 'POST',
                body: JSON.stringify({ id: doc.id, filename: doc.filename }),
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await res.json();

            if (!res.ok) {
                alert(`Failed to delete: ${data.error}`);
                console.log(`Failed to delete: ${data.error}`);
                return;
            }

            setDocuments(docs => docs.filter(d => d.id !== id)); // Optimistic UI update
            fetchDocuments(); // Refresh the document list
        } catch (err) {
            console.error("Delete error:", err);
            alert("Something went wrong while deleting.");
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col">
            {/* Header */}
            <header className="border-b border-gray-200 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <h1 className="text-xl font-bold text-gray-900">Admin Dashboard</h1>
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-gray-600">A</span>
                    </div>
                </div>
            </header>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex space-x-8">
                        <button
                            onClick={() => setActiveTab('queries')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'queries'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            User Queries
                        </button>
                        <button
                            onClick={() => setActiveTab('documents')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'documents'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            Knowledge Base
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {activeTab === 'queries' ? (
                    <div className="space-y-6">
                        <h2 className="text-lg font-medium text-gray-900">Recent User Queries</h2>
                        <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
                            {queries.map((query) => (
                                <div key={query.user_id} className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div className="flex-shrink-0">
                                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                                    <span className="text-blue-800">{query.user_name[0]}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{query.user_name}</p>
                                                {/* <p className="text-sm text-gray-500">{query.department}</p> */}
                                            </div>
                                        </div>
                                        <span className="text-sm text-gray-500">{dayjs.utc(query.created_at).tz("Asia/Kolkata").format("hh:mm A, DD/MM/YYYY")} ({dayjs.utc(query.created_at).tz("Asia/Kolkata").fromNow()})</span>
                                    </div>
                                    <p className="mt-4 text-gray-600">{query.user_prompt}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <h2 className="text-lg font-medium text-gray-900">Knowledge Base Documents</h2>

                        {/* Upload Area */}
                        <div
                            onDragEnter={handleDrag}
                            onDragLeave={handleDrag}
                            onDragOver={handleDrag}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-lg p-8 text-center ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                                }`}
                        >
                            <input
                                type="file"
                                accept="application/pdf"
                                className="hidden"
                                id="file-upload"
                                onChange={async (e) => {
                                    const files = e.target.files;
                                    if (!files || files.length === 0) {
                                        console.warn("No file selected.");
                                        return;
                                    }

                                    const file = files[0];
                                    console.log("Selected file:", file);

                                    if (file.type !== 'application/pdf') {
                                        alert(`File "${file.name}" is not a PDF.`);
                                        return;
                                    }

                                    const formData = new FormData();
                                    formData.append('file', file);

                                    try {
                                        const res = await fetch('/api/upload', {
                                            method: 'POST',
                                            body: formData,
                                        });

                                        const data = await res.json();
                                        console.log("Upload response:", data);

                                        if (!res.ok) {
                                            alert(`Upload failed: ${data.error}`);
                                            console.log(`Upload failed: ${data.error}`);
                                        } else {
                                            console.log("File uploaded successfully!");
                                            fetchDocuments(); // Refresh the document list
                                        }
                                    } catch (err) {
                                        console.error("Upload error:", err);
                                        alert("Something went wrong during upload.");
                                    }
                                }}
                            />


                            <label
                                htmlFor="file-upload"
                                className="cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                            >
                                Choose Files
                            </label>
                            <p className="mt-2 text-sm text-gray-500">or drag and drop files here</p>
                        </div>

                        {/* Documents List */}
                        <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
                            {documents.map((doc) => (
                                <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-gray-50 rounded-md">
                                    <div className="flex items-center space-x-4">
                                        <div className="flex-shrink-0">
                                            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{doc.filename}</p>
                                            <p className="text-sm text-gray-500">
                                                Uploaded {dayjs.utc(doc.upload_time).tz("Asia/Kolkata").format("DD MMM YYYY, hh:mm A")} • {(doc.filesize / (1024 * 1024)).toFixed(2)} MB
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className={`px-2 py-1 text-xs rounded-full ${doc.status === 'ready'
                                            ? 'bg-green-100 text-green-800'
                                            : doc.status === 'processing'
                                                ? 'bg-yellow-100 text-yellow-800'
                                                : 'bg-red-100 text-red-800'
                                            }`}>
                                            {doc.status}
                                        </span>
                                        <button
                                            onClick={() => handleDelete(doc.id)}
                                            className="text-gray-400 hover:text-red-600 transition duration-150 ease-in-out"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}