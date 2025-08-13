export default function Header() {
  return (
    <header className="bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
              <i className="fas fa-shield-alt text-white text-sm"></i>
            </div>
            <h1 className="text-xl font-bold text-slate-900">SecureScan</h1>
            <span className="text-sm text-slate-500 hidden sm:inline">GitHub Security Scanner</span>
          </div>
          <nav className="flex items-center space-x-6">
            <a href="#" className="text-slate-600 hover:text-slate-900 text-sm font-medium">Dashboard</a>
            <a href="#" className="text-slate-600 hover:text-slate-900 text-sm font-medium">History</a>
            <a href="#" className="text-slate-600 hover:text-slate-900 text-sm font-medium">Settings</a>
            <button className="bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors">
              <i className="fas fa-plus mr-2"></i>New Scan
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
