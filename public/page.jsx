import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, 
  PlusCircle, 
  Fingerprint, 
  Search, 
  Contrast, 
  Bot, 
  Users, 
  Grid3X3, 
  Database, 
  Bell, 
  LogOut, 
  FolderPlus, 
  DatabaseZap,
  Folder,
  Key,
  CheckCircle2,
  XCircle,
  MoreHorizontal,
  ChevronRight,
  RefreshCw,
  Terminal,
  Server,
  Lock,
  Globe,
  Plus
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, doc, setDoc, getDoc, collection, 
  onSnapshot, updateDoc, arrayUnion, query 
} from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'nexus-guard-v5';

// --- Constants ---
const PRIVILEGE_POOL = ['ADMIN', 'READ', 'WRITE', 'EXECUTE', 'BILLING', 'NETWORK', 'INFRASTRUCTURE', 'DATABASE_MANAGE'];

// --- Helper: Unique ID Generator ---
const generateEID = () => `NX-${Math.floor(1000 + Math.random() * 9000)}-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;

// --- TAILWIND CONFIG INJECTED TO MATCH HTML COLORS ---
window.tailwind.config = {
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "#197fe6",
                "primary-dark": "#156ac0",
                "background-light": "#f6f7f8",
                "background-dark": "#111921",
                "surface-dark": "#1c242c",
                "surface-border": "#293038", // Matching the border shades from HTML
            },
            fontFamily: { 
                "display": ["Manrope", "sans-serif"],
                "mono": ["JetBrains Mono", "monospace"]
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
            }
        },
    },
};

export default function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('landing'); 
  const [currentView, setCurrentView] = useState('access'); 
  const [activeOrg, setActiveOrg] = useState(null);
  const [allOrgs, setAllOrgs] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [loading, setLoading] = useState(true);

  // --- Initialize Auth & Live Sync ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth initialization failed", err);
      }
    };
    initAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const orgsCol = collection(db, 'artifacts', appId, 'public', 'data', 'organizations');
    const unsubscribeOrgs = onSnapshot(orgsCol, (snapshot) => {
      const orgList = snapshot.docs.map(d => d.data());
      setAllOrgs(orgList);
      
      if (activeOrg) {
        const updated = orgList.find(o => o.eid === activeOrg.eid);
        if (updated) setActiveOrg(updated);
      }
    }, (err) => console.error("Org Sync Error", err));

    const reqsCol = collection(db, 'artifacts', appId, 'public', 'data', 'requests');
    const unsubscribeReqs = onSnapshot(reqsCol, (snapshot) => {
      setPendingRequests(snapshot.docs.map(d => d.data()));
    }, (err) => console.error("Req Sync Error", err));

    return () => {
      unsubscribeOrgs();
      unsubscribeReqs();
    };
  }, [user, activeOrg?.eid]);

  // --- Global Actions ---
  const addToast = (msg, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  const handleCreateOrg = async (name) => {
    if (!user) return;
    const eid = generateEID();
    const orgData = {
      name,
      eid,
      creatorId: user.uid,
      roles: { 'Owner': PRIVILEGE_POOL },
      users: [{ uid: user.uid, name: 'Sovereign Admin', role: 'Owner', privs: PRIVILEGE_POOL }],
      infrastructure: { folders: [], databases: [] },
      isPopulated: false
    };

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'organizations', eid), orgData);
      setActiveOrg(orgData);
      setCurrentPage('dashboard');
      setCurrentView('access');
      addToast(`Infrastructure Node ${eid} Initialized`);
    } catch (err) {
      addToast("Failed to provision cloud hub", "error");
    }
  };

  const handleJoinRequest = async (eid) => {
    if (!user) return;
    if (eid === 'NX-8820-A') {
      addToast("Authorized handshake: Nexus Core Hub", "success");
      setActiveOrg({
        name: 'Nexus Core Hub',
        eid: 'NX-8820-A',
        isPopulated: true,
        roles: { 
          'Super Admin': PRIVILEGE_POOL, 
          'Manager': ['READ', 'WRITE', 'BILLING'],
          'Standard User': ['READ']
        },
        users: [{ uid: 'system', name: 'Jane Admin', role: 'Super Admin', privs: PRIVILEGE_POOL }],
        infrastructure: {
            folders: [
                { id: 'f1', name: 'Global Payroll', allowedRoles: ['Super Admin', 'Manager'], isPublic: false, created: '2025-11-20' },
                { id: 'f2', name: 'Open Documentation', allowedRoles: [], isPublic: true, created: '2026-01-01' }
            ],
            databases: [{ id: 'db1', name: 'Legacy_Registry', type: 'PostgreSQL', status: 'Healthy', traffic: '1.2k iops' }]
        }
      });
      setCurrentPage('dashboard');
      setCurrentView('resources');
      return;
    }

    const org = allOrgs.find(o => o.eid === eid);
    if (!org) {
      addToast("Target Node Offline or Invalid EID", "error");
      return;
    }

    try {
      const reqId = `${eid}_${user.uid}`;
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requests', reqId), {
        id: reqId,
        targetEid: eid,
        requesterId: user.uid,
        name: `Node_${user.uid.slice(0, 4)}`,
        status: 'PENDING',
        date: new Date().toISOString()
      });
      addToast("Handshake sent to Admin queue", "info");
    } catch (err) {
      addToast("Handshake failed", "error");
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-background-dark flex flex-col items-center justify-center gap-4">
      <div className="loader !w-12 !h-12"></div>
      <p className="text-[10px] font-black uppercase text-slate-500 animate-pulse tracking-[0.2em]">Syncing Security Clusters...</p>
    </div>
  );

  return (
    <div className={`${isDarkMode ? 'dark' : ''}`}>
      <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 min-h-screen flex flex-col transition-colors duration-300 font-display">
        
        {/* Toasts */}
        <div className="fixed top-6 right-6 z-[1000] flex flex-col gap-3">
          {toasts.map(t => (
            <div key={t.id} className={`${t.type === 'error' ? 'bg-red-500' : t.type === 'info' ? 'bg-blue-500' : 'bg-emerald-500'} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-up text-[10px] font-black uppercase tracking-widest`}>
              <CheckCircle2 size={16} /> {t.msg}
            </div>
          ))}
        </div>

        {currentPage === 'landing' && (
          <LandingPage 
            allOrgs={allOrgs} 
            onJoin={handleJoinRequest} 
            onCreate={() => setCurrentPage('onboarding')}
            toggleTheme={() => setIsDarkMode(!isDarkMode)}
          />
        )}

        {currentPage === 'onboarding' && (
          <OnboardingPage 
            onCancel={() => setCurrentPage('landing')} 
            onFinalize={handleCreateOrg} 
          />
        )}

        {currentPage === 'dashboard' && activeOrg && (
          <DashboardShell 
            activeOrg={activeOrg}
            currentView={currentView}
            setCurrentView={setCurrentView}
            user={user}
            requests={pendingRequests.filter(r => r.targetEid === activeOrg.eid && r.status === 'PENDING')}
            onLogout={() => { setCurrentPage('landing'); setActiveOrg(null); }}
            db={db}
            appId={appId}
            addToast={addToast}
          />
        )}
      </div>
      <style>{`
        .loader { border: 2px solid #f3f3f3; border-top: 2px solid #197fe6; border-radius: 50%; width: 16px; height: 16px; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </div>
  );
}

// --- PAGE: LANDING ---
function LandingPage({ allOrgs, onJoin, onCreate, toggleTheme }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredOrgs = useMemo(() => {
    const q = searchQuery.toLowerCase();
    if (q.length < 2) return [];
    const found = allOrgs.filter(o => o.name?.toLowerCase().includes(q) || o.eid?.toLowerCase().includes(q));
    if ("nexus core hub".includes(q) || "nx-8820-a".includes(q)) {
        if (!found.find(o => o.eid === 'NX-8820-A')) {
          found.push({ name: 'Nexus Core Hub', eid: 'NX-8820-A', isPopulated: true });
        }
    }
    return found;
  }, [searchQuery, allOrgs]);

  return (
    <div className="flex-grow flex flex-col">
      <header className="fixed top-0 w-full z-50 border-b border-slate-200 dark:border-surface-border bg-white dark:bg-background-dark px-6 py-4 flex items-center justify-between gap-6">
        <div className="flex items-center gap-3 shrink-0">
          <div className="size-9 bg-primary/20 rounded-xl flex items-center justify-center text-primary border border-primary/20"><Shield size={20} /></div>
          <h2 className="text-xl font-extrabold tracking-tight dark:text-white hidden sm:block">NexusGuard</h2>
        </div>

        <div className="flex-1 max-w-lg relative">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
              placeholder="Search organizational nodes (Try 'Nexus')..." 
              className="w-full h-11 pl-12 pr-4 rounded-full border border-slate-200 dark:border-surface-border bg-white dark:bg-surface-dark focus:ring-2 focus:ring-primary outline-none transition-all text-sm"
            />
          </div>
          {showSuggestions && filteredOrgs.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-border rounded-2xl shadow-2xl overflow-hidden z-50 animate-fade-in">
              {filteredOrgs.map(org => (
                <button 
                  key={org.eid}
                  onClick={() => { onJoin(org.eid); setShowSuggestions(false); setSearchQuery(''); }}
                  className="w-full p-4 hover:bg-primary/5 flex items-center gap-4 text-left border-b border-slate-100 dark:border-surface-border last:border-0"
                >
                  <div className="size-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center"><Bot size={20} /></div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold dark:text-white">{org.name}</h4>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">EID: {org.eid}</p>
                  </div>
                  <ChevronRight size={16} className="text-slate-400" />
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-surface-dark transition-colors"><Contrast size={20}/></button>
      </header>

      <main className="flex-grow flex items-center justify-center p-6 pt-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none -z-10">
            <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px]" />
            <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px]" />
        </div>

        <div className="w-full max-w-[850px] grid grid-cols-1 md:grid-cols-2 gap-8 animate-slide-up">
          <LandingCard 
            icon={<PlusCircle className="text-primary" size={32} />} 
            title="Create Enterprise" 
            desc="Deploy a fresh security cluster. Start with zero roles and define your matrix from scratch." 
            onClick={onCreate}
            btnLabel="Launch Scratch Hub"
          />
          <LandingCard 
            icon={<Fingerprint className="text-emerald-500" size={32} />} 
            title="Join as Outsider" 
            desc="Established handshakes with existing nodes. Identity clearance required for file access." 
            onClick={() => {
              const eid = prompt("Enter Target Node EID (e.g. NX-8820-A):");
              if (eid) onJoin(eid);
            }}
            btnLabel="Join via Unique EID"
            secondary
          />
        </div>
      </main>
    </div>
  );
}

function LandingCard({ icon, title, desc, onClick, btnLabel, secondary }) {
  return (
    <div className="bg-white dark:bg-surface-dark p-10 rounded-[48px] shadow-2xl border border-slate-200 dark:border-surface-border space-y-6 flex flex-col h-full group hover:scale-[1.02] transition-all">
      <div className={`size-16 rounded-3xl flex items-center justify-center ${secondary ? 'bg-emerald-500/10' : 'bg-primary/10'}`}>
        {icon}
      </div>
      <div className="flex-1">
        <h2 className="text-2xl font-black tracking-tight dark:text-white">{title}</h2>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">{desc}</p>
      </div>
      <button 
        onClick={onClick}
        className={`w-full h-14 font-black uppercase text-[10px] rounded-2xl shadow-xl transition-all ${secondary ? 'border-2 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/5' : 'bg-primary text-white hover:bg-primary-dark shadow-primary/20'}`}
      >
        {btnLabel}
      </button>
    </div>
  );
}

// --- PAGE: ONBOARDING ---
function OnboardingPage({ onCancel, onFinalize }) {
  const [name, setName] = useState('');
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background-light dark:bg-background-dark">
      <div className="w-full max-w-md bg-white dark:bg-surface-dark p-10 rounded-[40px] shadow-2xl border border-slate-200 dark:border-surface-border space-y-8 animate-slide-up">
        <div className="text-center">
            <h3 className="text-2xl font-black dark:text-white">Node Setup</h3>
            <p className="text-xs text-slate-500 mt-1 uppercase font-bold tracking-widest">Scratch Initiation</p>
        </div>
        <div className="space-y-6">
            <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Org Identity</label>
                <input 
                  autoFocus
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Stark Industries" 
                  className="w-full h-14 px-5 rounded-2xl border border-slate-200 dark:border-surface-border bg-transparent outline-none focus:ring-2 focus:ring-primary font-bold dark:text-white"
                />
            </div>
            <div className="p-5 bg-background-light dark:bg-background-dark rounded-3xl border border-slate-100 dark:border-surface-border">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Generated EID</p>
                <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-primary tracking-widest uppercase">NX-####-X</span>
                    <RefreshCw size={14} className="text-slate-400" />
                </div>
            </div>
        </div>
        <button 
          onClick={() => onFinalize(name)}
          className="w-full h-14 bg-primary text-white font-black uppercase text-[10px] rounded-2xl shadow-xl shadow-primary/20 transition-transform active:scale-95"
        >
          Deploy Empty Infrastructure
        </button>
        <button onClick={onCancel} className="w-full text-[10px] font-bold text-slate-400 uppercase">Return to Portal</button>
      </div>
    </div>
  );
}

// --- PAGE: DASHBOARD SHELL ---
function DashboardShell({ activeOrg, currentView, setCurrentView, user, requests, onLogout, db, appId, addToast }) {
  const [modalType, setModalType] = useState(null);
  const [targetReq, setTargetReq] = useState(null);

  const isAdmin = useMemo(() => {
    return activeOrg.creatorId === user?.uid || activeOrg.users?.some(u => u.uid === user?.uid && (u.role === 'Owner' || u.role === 'Super Admin'));
  }, [activeOrg, user]);

  const userPermissions = useMemo(() => {
    if (isAdmin) return PRIVILEGE_POOL;
    const member = activeOrg.users?.find(u => u.uid === user?.uid);
    return member?.privs || ['READ'];
  }, [activeOrg, user, isAdmin]);

  return (
    <div className="flex h-screen overflow-hidden animate-fade-in">
      {/* Sidebar */}
      <aside className="w-72 bg-white dark:bg-surface-dark border-r border-slate-200 dark:border-surface-border flex flex-col z-20">
        <div className="p-8 border-b border-slate-100 dark:border-surface-border flex items-center gap-3">
          <div className={`size-10 rounded-2xl flex items-center justify-center text-white shadow-xl ${isAdmin ? 'bg-primary' : 'bg-emerald-500'}`}>
            {isAdmin ? <Bot size={24} /> : <Fingerprint size={24} />}
          </div>
          <div className="overflow-hidden">
            <h3 className={`font-black text-[10px] uppercase ${isAdmin ? 'text-primary' : 'text-emerald-500'} tracking-widest`}>
                {isAdmin ? 'Management Hub' : 'Member Node'}
            </h3>
            <p className="text-xs font-bold truncate dark:text-white">{activeOrg.name}</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {isAdmin ? (
            <>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-3 mt-2">Sovereign Cluster</p>
              <NavItem active={currentView === 'access'} onClick={() => setCurrentView('access')} icon={<Users size={18}/>} label="Access Control" />
              <NavItem active={currentView === 'matrix'} onClick={() => setCurrentView('matrix')} icon={<Grid3X3 size={18}/>} label="Policy Matrix" />
              <NavItem active={currentView === 'database'} onClick={() => setCurrentView('database')} icon={<Database size={18}/>} label="Infrastructure" />
              <NavItem active={currentView === 'requests'} onClick={() => setCurrentView('requests')} icon={<Bell size={18}/>} label="Approvals" badge={requests.length} />
            </>
          ) : (
            <>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-3 mb-3 mt-2">Member Portal</p>
              <NavItem active={currentView === 'resources'} onClick={() => setCurrentView('resources')} icon={<Folder size={18}/>} label="Resource Hub" />
              <NavItem active={currentView === 'my-keys'} onClick={() => setCurrentView('my-keys')} icon={<Key size={18}/>} label="Identity Node" />
            </>
          )}
        </nav>

        <div className="p-6 border-t border-slate-100 dark:border-surface-border">
          <button onClick={onLogout} className="w-full py-3 bg-red-500/10 text-red-500 text-[10px] font-black uppercase rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2">
            <LogOut size={14} /> Disconnect
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-background-light dark:bg-background-dark">
        <header className="h-20 border-b border-slate-200 dark:border-surface-border bg-white/50 dark:bg-background-dark/50 backdrop-blur-md flex items-center justify-between px-8">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight dark:text-white uppercase tracking-widest">
                {currentView.replace('-', ' ')}
            </h1>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em]">Node: {activeOrg.eid}</p>
          </div>

          <div className="flex-1 max-w-md mx-8 relative group hidden md:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
                type="text" 
                placeholder="Search resources..." 
                className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-surface-border bg-slate-50 dark:bg-slate-900/50 text-xs font-bold focus:ring-2 focus:ring-primary outline-none transition-all dark:text-white"
                onKeyDown={(e) => e.key === 'Enter' && addToast(`Searching for '${e.target.value}'...`, 'info')}
            />
          </div>

          <div className="flex items-center gap-4">
             {isAdmin && (
                <div className="flex gap-2">
                    <button onClick={() => setModalType('folder')} title="Add Folder" className="p-2.5 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-all"><FolderPlus size={18}/></button>
                    <button onClick={() => setModalType('db')} title="Add Database" className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-xl hover:bg-indigo-500/20 transition-all"><DatabaseZap size={18}/></button>
                </div>
             )}
             <div className="h-8 w-px bg-slate-200 dark:border-surface-border" />
             <div className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-full text-[9px] font-black uppercase tracking-widest">Synced</div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 animate-fade-in">
          {currentView === 'access' && <AccessControlView org={activeOrg} />}
          {currentView === 'matrix' && <MatrixView org={activeOrg} db={db} appId={appId} addToast={addToast} />}
          {currentView === 'database' && <DatabaseView org={activeOrg} />}
          {currentView === 'requests' && <RequestsView requests={requests} org={activeOrg} setTargetReq={setTargetReq} setModalType={setModalType} />}
          {currentView === 'resources' && <ResourceHubView org={activeOrg} userPrivs={userPermissions} />}
          {currentView === 'my-keys' && <IdentityKeysView user={user} role={isAdmin ? 'Owner' : 'Standard User'} privs={userPermissions} />}
        </div>
      </main>

      {modalType && (
        <Modal 
            type={modalType} 
            onClose={() => { setModalType(null); setTargetReq(null); }} 
            org={activeOrg} 
            db={db} 
            appId={appId} 
            addToast={addToast}
            targetReq={targetReq}
        />
      )}
    </div>
  );
}

const NavItem = ({ active, onClick, icon, label, badge }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl text-xs font-bold transition-all ${active ? 'bg-primary text-white shadow-xl shadow-primary/20' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400'}`}
  >
    <div className="flex items-center gap-3">
      {icon} {label}
    </div>
    {badge > 0 && <span className="px-2 py-0.5 rounded-full bg-orange-500 text-white text-[8px] font-black animate-pulse">{badge}</span>}
  </button>
);

function AccessControlView({ org }) {
  return (
    <div className="bg-white dark:bg-surface-dark rounded-[40px] border border-slate-200 dark:border-surface-border shadow-2xl overflow-hidden">
        <table className="w-full text-left">
            <thead className="bg-slate-50/50 dark:bg-background-dark border-b border-slate-200 dark:border-surface-border text-[10px] font-black uppercase text-slate-400 tracking-[0.15em]">
                <tr><th className="p-6">Identity Node</th><th className="p-6">Policy Group</th><th className="p-6 text-right">Scope</th></tr>
            </thead>
            <tbody className="text-sm">
                {org.users?.map((u, i) => (
                    <tr key={i} className="border-b border-slate-100 dark:border-surface-border/50 hover:bg-slate-50/50 dark:hover:bg-background-dark transition-colors">
                        <td className="p-6 flex items-center gap-3">
                            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">{u.name ? u.name[0] : '?'}</div>
                            <span className="font-bold dark:text-white">{u.name}</span>
                        </td>
                        <td className="p-6"><span className="px-2 py-1 rounded bg-slate-100 dark:bg-background-dark text-[8px] font-black uppercase">{u.role}</span></td>
                        <td className="p-6 text-right font-mono text-[9px] text-primary">{u.privs?.slice(0,3).join(', ')}...</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
  );
}

function MatrixView({ org, db, appId, addToast }) {
  const roles = Object.entries(org.roles || {});
  const [newRoleName, setNewRoleName] = useState('');
  const [newRolePrivs, setNewRolePrivs] = useState([]);

  const togglePriv = async (roleName, priv) => {
    let currentPrivs = [...org.roles[roleName]];
    if (currentPrivs.includes(priv)) currentPrivs = currentPrivs.filter(p => p !== priv);
    else currentPrivs.push(priv);
    
    try {
        const orgDoc = doc(db, 'artifacts', appId, 'public', 'data', 'organizations', org.eid);
        await updateDoc(orgDoc, { [`roles.${roleName}`]: currentPrivs });
        addToast("Matrix Policy Propagated");
    } catch (err) { addToast("Sync failed", "error"); }
  };

  const handleCreateRole = async () => {
      if(!newRoleName || newRolePrivs.length === 0) return;
      try {
        const orgDoc = doc(db, 'artifacts', appId, 'public', 'data', 'organizations', org.eid);
        await updateDoc(orgDoc, { [`roles.${newRoleName}`]: newRolePrivs });
        addToast(`Role '${newRoleName}' created`);
        setNewRoleName('');
        setNewRolePrivs([]);
      } catch(err) { addToast("Failed to create role", "error"); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-white dark:bg-surface-dark p-8 rounded-[40px] border border-slate-200 dark:border-surface-border shadow-xl space-y-6 h-fit">
            <h3 className="text-xl font-black dark:text-white">Role Designer</h3>
            <input 
                type="text" 
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Role Name" 
                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-surface-border bg-transparent font-bold outline-none focus:ring-2 focus:ring-primary dark:text-white"
            />
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {PRIVILEGE_POOL.map(p => (
                    <label key={p} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-background-dark rounded-xl cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={newRolePrivs.includes(p)}
                            onChange={(e) => {
                                if(e.target.checked) setNewRolePrivs([...newRolePrivs, p]);
                                else setNewRolePrivs(newRolePrivs.filter(x => x !== p));
                            }}
                            className="rounded text-primary bg-transparent focus:ring-primary"
                        />
                        <span className="text-[10px] font-bold text-slate-500">{p}</span>
                    </label>
                ))}
            </div>
            <button 
                onClick={handleCreateRole}
                className="w-full h-12 bg-primary text-white font-black uppercase text-[10px] rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all"
            >
                Commit Policy
            </button>
        </div>

        <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-surface-dark p-8 rounded-[48px] border border-slate-200 dark:border-surface-border shadow-2xl overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                        <tr className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                            <th className="p-4 border-b border-slate-100 dark:border-surface-border">Role</th>
                            {PRIVILEGE_POOL.map(p => <th key={p} className="p-4 border-b border-slate-100 dark:border-surface-border text-center">{p}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {roles.map(([name, privs]) => (
                            <tr key={name} className="hover:bg-slate-50 dark:hover:bg-background-dark transition-colors group">
                                <td className="p-4 border-b border-slate-100 dark:border-surface-border font-bold text-sm text-primary">{name}</td>
                                {PRIVILEGE_POOL.map(p => (
                                    <td key={p} className="p-4 border-b border-slate-100 dark:border-surface-border text-center matrix-cell">
                                        <input 
                                            type="checkbox" 
                                            checked={privs.includes(p)} 
                                            onChange={() => togglePriv(name, p)}
                                            className="size-5 rounded border-slate-300 text-primary focus:ring-primary bg-transparent"
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-6 bg-background-dark rounded-3xl border border-surface-border flex items-center gap-4 text-emerald-500 font-mono text-[10px]">
                <Terminal size={18}/>
                <span>{'{'} Policy Orchestration Engine: Toggling a cell instantly affects clearance for all linked identity nodes. {'}'}</span>
            </div>
        </div>
    </div>
  );
}

function DatabaseView({ org }) {
    const [employees, setEmployees] = useState([]);
    useEffect(() => {
        if(org.isPopulated) {
            const seed = [];
            for(let i=1; i<=100; i++) seed.push({ eid: `NX-E${1000+i}`, name: `Staff Member ${i}`, role: 'Analyst', dept: 'Operations' });
            setEmployees(seed);
        } else {
            setEmployees([]);
        }
    }, [org.isPopulated]);

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <h3 className="text-lg font-black flex items-center gap-2 px-2"><Folder size={20} className="text-primary"/> Storage Nodes</h3>
                    <div className="grid grid-cols-1 gap-3">
                        {org.infrastructure?.folders?.map(f => (
                            <div key={f.id} className="p-6 bg-white dark:bg-surface-dark border border-slate-200 dark:border-surface-border rounded-3xl flex justify-between items-center group">
                                <div className="flex items-center gap-3">
                                    <div className="size-10 rounded-xl bg-background-light dark:bg-background-dark flex items-center justify-center text-slate-400 group-hover:text-primary transition-all">
                                        <Folder size={24}/>
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm dark:text-white">{f.name}</p>
                                        <p className={`text-[8px] font-black uppercase ${f.isPublic ? 'text-emerald-500' : 'text-orange-500'}`}>{f.isPublic ? 'Public' : 'Protected'}</p>
                                    </div>
                                </div>
                                <div className="flex -space-x-1">
                                    {f.allowedRoles?.map(r => <div key={r} title={r} className="size-6 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-white dark:border-surface-dark text-[8px] flex items-center justify-center font-bold">{r[0]}</div>)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="space-y-4">
                    <h3 className="text-lg font-black flex items-center gap-2 px-2"><Database size={20} className="text-indigo-500"/> Infrastructure DB</h3>
                    <div className="grid grid-cols-1 gap-3">
                        {org.infrastructure?.databases?.map(db => (
                            <div key={db.id} className="p-6 bg-background-dark text-white rounded-[32px] border border-surface-border space-y-4 shadow-xl">
                                <div className="flex justify-between items-start">
                                    <h4 className="font-bold text-sm">{db.name}</h4>
                                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-500 text-[8px] font-black uppercase">{db.status}</span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] opacity-60">
                                    <span>Engine: {db.type}</span>
                                    <span>Traffic: {db.traffic}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function RequestsView({ requests, org, setTargetReq, setModalType }) {
    if (requests.length === 0) return <div className="p-20 text-center opacity-30 font-black uppercase tracking-widest">Handshake Pipeline Clear</div>;
    return (
        <div className="space-y-4">
            {requests.map(req => (
                <div key={req.id} className="p-8 bg-white dark:bg-surface-dark rounded-[40px] border border-orange-500/20 shadow-xl flex items-center justify-between animate-fade-in">
                    <div>
                        <h4 className="font-black text-lg dark:text-white">{req.name}</h4>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Requester: {req.requesterId?.slice(0,8)}</p>
                    </div>
                    <button 
                        onClick={() => { setTargetReq(req); setModalType('provision'); }}
                        className="px-8 py-3 bg-orange-500 text-white text-[10px] font-black uppercase rounded-2xl shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
                    >
                        Review & Provision
                    </button>
                </div>
            ))}
        </div>
    );
}

function ResourceHubView({ org, userPrivs }) {
    const folders = org.infrastructure?.folders?.filter(f => f.isPublic || userPrivs.includes('ADMIN') || f.allowedRoles?.some(r => org.roles[r]?.some(p => userPrivs.includes(p))));
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {folders?.map(fol => (
                <div key={fol.id} className="p-10 bg-white dark:bg-surface-dark rounded-[48px] border border-slate-200 dark:border-surface-border relative group overflow-hidden hover:shadow-2xl transition-all cursor-pointer">
                    <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6"><Folder size={32}/></div>
                    <h4 className="font-bold text-lg dark:text-white">{fol.name}</h4>
                    <div className="mt-6 flex items-center gap-2">
                        <span className={`size-1.5 rounded-full ${fol.isPublic ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
                        <span className="text-[10px] font-black uppercase text-slate-500">{fol.isPublic ? 'Public Access' : 'Encrypted Access'}</span>
                    </div>
                </div>
            ))}
            {(!folders || folders.length === 0) && <div className="col-span-full p-20 text-center opacity-30 font-black uppercase tracking-widest">No Authorized Nodes Linked</div>}
        </div>
  );
}

function IdentityKeysView({ user, role, privs }) {
    return (
        <div className="max-w-xl mx-auto bg-white dark:bg-surface-dark p-12 rounded-[56px] border border-slate-200 dark:border-surface-border text-center space-y-8 shadow-2xl">
            <div className="size-20 bg-emerald-500/10 text-emerald-500 flex items-center justify-center rounded-full mx-auto"><CheckCircle2 size={44}/></div>
            <div>
                <h3 className="text-4xl font-black dark:text-white">Clearance Active</h3>
                <p className="text-slate-500 mt-2 font-medium tracking-wide">Node Identity: {user?.uid?.slice(0, 8)} • Role: {role}</p>
            </div>
            <div className="p-8 bg-background-light dark:bg-background-dark rounded-[32px] font-mono text-primary font-bold text-xs tracking-widest break-all uppercase border border-slate-100 dark:border-surface-border">
                NX-SEC-TOKEN-{Math.random().toString(36).substring(2).toUpperCase()}
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
                {privs.slice(0,5).map(p => <span key={p} className="px-3 py-1 bg-primary/5 text-primary text-[8px] font-black rounded-lg border border-primary/10">{p}</span>)}
                {privs.length > 5 && <span className="px-3 py-1 text-slate-400 text-[8px] font-black">+{privs.length - 5} MORE</span>}
            </div>
        </div>
    );
}

function Modal({ type, onClose, org, db, appId, addToast, targetReq }) {
  const [name, setName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [isPublic, setIsPublic] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const orgDoc = doc(db, 'artifacts', appId, 'public', 'data', 'organizations', org.eid);

    try {
        if (type === 'folder') {
            await updateDoc(orgDoc, { 'infrastructure.folders': arrayUnion({ id: 'fol'+Date.now(), name, allowedRoles: selectedRoles, isPublic, created: 'Just Now' }) });
            addToast("Folder Deployed");
        } else if (type === 'db') {
            await updateDoc(orgDoc, { 'infrastructure.databases': arrayUnion({ id: 'db'+Date.now(), name, type: 'PostgreSQL', status: 'Healthy', traffic: '0 iops' }) });
            addToast("Database Linked");
        } else if (type === 'provision') {
            const role = document.getElementById('roleSel').value;
            const newUser = { uid: targetReq.requesterId, name: targetReq.name, role, privs: org.roles[role] || ['READ'] };
            await updateDoc(orgDoc, { users: arrayUnion(newUser) });
            await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'requests', targetReq.id), { status: 'APPROVED' });
            addToast(`Identity node ${targetReq.name} activated`);
        }
    } catch (err) { addToast("Operation failed", "error"); }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[500] flex items-center justify-center p-6 animate-fade-in">
        <div className="bg-white dark:bg-surface-dark w-full max-w-lg rounded-[48px] border border-slate-200 dark:border-surface-border p-12 shadow-2xl relative animate-slide-up">
            <button onClick={onClose} className="absolute top-8 right-8 text-slate-400 hover:text-slate-100"><XCircle/></button>
            
            {type === 'folder' && (
                <form onSubmit={handleSubmit} className="space-y-8">
                    <h3 className="text-3xl font-black dark:text-white">New Folder</h3>
                    <input autoFocus required value={name} onChange={e => setName(e.target.value)} placeholder="Folder Identifier" className="w-full h-14 px-5 rounded-2xl border border-slate-200 dark:border-surface-border bg-transparent font-bold outline-none focus:ring-2 focus:ring-primary dark:text-white" />
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Access Roles</label>
                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                            {Object.keys(org.roles || {}).map(r => (
                                <label key={r} className="flex items-center gap-3 p-4 bg-background-light dark:bg-background-dark rounded-2xl border border-slate-100 dark:border-surface-border cursor-pointer">
                                    <input type="checkbox" onChange={e => e.target.checked ? setSelectedRoles([...selectedRoles, r]) : setSelectedRoles(selectedRoles.filter(x => x !== r))} className="rounded text-primary"/>
                                    <span className="text-[10px] font-bold text-slate-500">{r}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center justify-between p-5 bg-background-light dark:bg-background-dark rounded-3xl">
                        <div><p className="text-xs font-bold dark:text-white">Public Clearance</p></div>
                        <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="size-6 rounded border-slate-300 text-emerald-500" />
                    </div>
                    <button type="submit" className="w-full h-14 bg-primary text-white font-black uppercase text-[10px] rounded-2xl">Deploy Hub</button>
                </form>
            )}

            {type === 'db' && (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <h3 className="text-3xl font-black dark:text-white">New Instance</h3>
                    <input required value={name} onChange={e => setName(e.target.value)} placeholder="DB Identifier" className="w-full h-14 px-5 rounded-2xl border border-slate-200 dark:border-surface-border bg-transparent font-bold outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white" />
                    <select className="w-full h-14 px-5 rounded-2xl border border-slate-200 dark:border-surface-border bg-transparent font-bold outline-none"><option>PostgreSQL</option><option>Redis</option></select>
                    <button type="submit" className="w-full h-14 bg-indigo-500 text-white font-black uppercase text-[10px] rounded-2xl shadow-xl">Initialize</button>
                </form>
            )}

            {type === 'provision' && (
                <form onSubmit={handleSubmit} className="space-y-8">
                    <h3 className="text-3xl font-black dark:text-white">Provision Access</h3>
                    <p className="text-slate-500">Establishing handshake for <b>{targetReq.name}</b></p>
                    <select id="roleSel" required className="w-full h-14 px-5 rounded-2xl border border-slate-200 dark:border-surface-border bg-transparent font-bold outline-none dark:text-white">
                        {Object.keys(org.roles || {}).map(r => <option key={r}>{r}</option>)}
                    </select>
                    <button type="submit" className="w-full h-14 bg-emerald-600 text-white font-black uppercase text-[10px] rounded-2xl shadow-xl">Authorize Node</button>
                </form>
            )}
        </div>
    </div>
  );
}