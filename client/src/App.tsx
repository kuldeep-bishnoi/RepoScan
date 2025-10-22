import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import Settings from "@/pages/settings";

function Nav() {
  const [location] = useLocation();
  
  return (
    <nav className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center no-underline">
              <i className="fas fa-shield-alt text-brand-500 text-2xl mr-3"></i>
              <span className="text-xl font-bold text-slate-900">SecureScan</span>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            <Link 
              href="/"
              className={`px-4 py-2 rounded-md text-sm font-medium no-underline ${
                location === "/" 
                  ? "bg-brand-50 text-brand-700" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
              data-testid="nav-dashboard"
            >
              <i className="fas fa-home mr-2"></i>
              Dashboard
            </Link>
            <Link 
              href="/settings"
              className={`px-4 py-2 rounded-md text-sm font-medium no-underline ${
                location === "/settings" 
                  ? "bg-brand-50 text-brand-700" 
                  : "text-slate-600 hover:text-slate-900"
              }`}
              data-testid="nav-settings"
            >
              <i className="fas fa-cog mr-2"></i>
              Settings
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

function Router() {
  return (
    <>
      <Nav />
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/scan/:id" component={Dashboard} />
        <Route path="/settings" component={Settings} />
        <Route>
          <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
            <div className="text-center">
              <h1 className="text-2xl font-bold text-slate-900 mb-2">404 - Page Not Found</h1>
              <p className="text-slate-600">The page you're looking for doesn't exist.</p>
            </div>
          </div>
        </Route>
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
