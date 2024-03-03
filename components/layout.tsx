interface LayoutProps {
  children?: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="mx-auto flex flex-col space-y-4">
      <header className="container sticky top-0 z-40 bg-white">
        <div className="h-16 border-b border-b-slate-200 py-4 flex justify-between items-center">
          <nav className="ml-4 pl-6">
            <a href="https://www.anandalibrary.org/" className="hover:text-slate-600 cursor-pointer">
              ← Back to Ananda Library
            </a>
          </nav>
          <nav className="mr-4 pr-6">
            <a href="https://www.anandalibrary.org/content/ai-chatbot-intro/" className="hover:text-slate-600 cursor-pointer">
              Help
            </a>
          </nav>
        </div>
      </header>
      <div>
        <main className="flex w-full flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
