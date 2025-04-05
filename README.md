# Tax Copilot

A modern web application built with Next.js that helps Indian tax professionals navigate the tax laws with AI-powered assistance.

## Getting Started

### Prerequisites

- Node.js 18.0 or later
- npm or yarn package manager
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Docker (for running Supabase locally)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Prithvi-k/tax-copilot.git
cd tax-copilot
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Local Environment Setup

```bash
cp env.sample .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Running 

1. Supabase Local Setup

```bash
sudo supabase start
```
This spins up Supabase with Postgres, Auth, and Storage in Docker. By default, it runs at http://localhost:54321


2. Start the development server:
```bash
npm run dev
# or
yarn dev
```

The application will be available at `http://localhost:3000`.

### Notes

- Uploaded files stored locally at `/data/user_docs`
- 2 Tables setup in Supabase : 
  - _queries_: Stores user prompts and metadata
  - _uploaded\_files_: Stores uploaded file metadata (filename, status, size, etc.)
