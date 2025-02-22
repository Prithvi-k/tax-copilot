// src/app/admin/page.tsx
'use client';

import { useState } from 'react';

interface UserQuery {
    userId: string;
    userName: string;
    prompt: string;
    timestamp: string;
    department: string;
}

interface Document {
    id: string;
    name: string;
    uploadedBy: string;
    uploadDate: string;
    size: string;
    status: 'processing' | 'ready' | 'error';
}

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState<'queries' | 'documents'>('queries');
    const [dragActive, setDragActive] = useState(false);

    // Sample data
    const recentQueries: UserQuery[] = [
        {
            userId: "U123",
            userName: "John Doe",
            prompt: "What are the new tax implications for remote workers?",
            timestamp: "2024-02-23 14:30",
            department: "Finance"
        },
        {
            userId: "U124",
            userName: "Jane Smith",
            prompt: "How do we handle international client payments?",
            timestamp: "2024-02-23 14:15",
            department: "Sales"
        }
    ];

    const documents: Document[] = [
        {
            id: "D1",
            name: "Internal_Tax_Guidelines_2024.pdf",
            uploadedBy: "Admin",
            uploadDate: "2024-02-22",
            size: "2.4 MB",
            status: "ready"
        },
        {
            id: "D2",
            name: "Client_Confidential_Procedures.docx",
            uploadedBy: "Admin",
            uploadDate: "2024-02-21",
            size: "1.8 MB",
            status: "processing"
        }
    ];

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
                            {recentQueries.map((query) => (
                                <div key={query.userId} className="p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                            <div className="flex-shrink-0">
                                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                                    <span className="text-blue-800">{query.userName[0]}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{query.userName}</p>
                                                <p className="text-sm text-gray-500">{query.department}</p>
                                            </div>
                                        </div>
                                        <span className="text-sm text-gray-500">{query.timestamp}</span>
                                    </div>
                                    <p className="mt-4 text-gray-600">{query.prompt}</p>
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
                                multiple
                                className="hidden"
                                id="file-upload"
                                onChange={(e) => console.log("Files:", e.target.files)}
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
                                <div key={doc.id} className="p-4 flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div className="flex-shrink-0">
                                            <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                                            <p className="text-sm text-gray-500">
                                                Uploaded {doc.uploadDate} • {doc.size}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 text-xs rounded-full ${doc.status === 'ready'
                                        ? 'bg-green-100 text-green-800'
                                        : doc.status === 'processing'
                                            ? 'bg-yellow-100 text-yellow-800'
                                            : 'bg-red-100 text-red-800'
                                        }`}>
                                        {doc.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}