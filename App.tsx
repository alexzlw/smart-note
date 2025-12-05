
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  BookOpen, 
  BarChart2, 
  Filter,
  GraduationCap,
  Menu,
  X,
  Settings,
  LogIn,
  LogOut,
  User as UserIcon,
  Cloud
} from 'lucide-react';
import { MistakeItem, Subject, MasteryLevel } from './types';
import Dashboard from './components/Dashboard';
import AddMistakeModal from './components/AddMistakeModal';
import ReviewCard from './components/ReviewCard';
import SettingsModal from './components/SettingsModal';
import { firebaseService, auth } from './services/firebase';
import { User } from 'firebase/auth';

const App: React.FC = () => {
  // State
  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [view, setView] = useState<'dashboard' | 'review'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<Subject | 'All'>('All');
  const [filterMastery, setFilterMastery] = useState<MasteryLevel | 'All'>('All');
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Auth State
  const [user, setUser] = useState<User | null>(null);

  // Load data logic
  const loadData = async (currentUser: User | null) => {
    try {
      setIsLoading(true);
      const data = await firebaseService.getAllMistakes(currentUser);
      setMistakes(data);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
        setUser(u);
        loadData(u);
    });
    return () => unsubscribe();
  }, []);

  // Handlers
  const handleLogin = async () => {
      try {
          await firebaseService.login();
      } catch (e) {
          alert("ログインに失敗しました。");
      }
  };

  const handleLogout = async () => {
      if(confirm("ログアウトしますか？\n（クラウドとの同期が停止します）")) {
        await firebaseService.logout();
      }
  };

  const handleAddMistake = async (item: MistakeItem) => {
    try {
        // Optimistic UI update
        setMistakes(prev => [item, ...prev]);
        await firebaseService.addMistake(user, item);
        
        // If uploading image to cloud, the URL changes, so reload is safer
        // But for UX, we keep optimistic. 
        // In a real app, we'd wait for the ID/URL back.
        if (user) {
            loadData(user); // Reload to get real Image URL from cloud
        }
        
        setView('review'); 
    } catch (e) {
        console.error("Failed to save mistake", e);
        alert("保存に失敗しました。");
        // Revert on error
        loadData(user);
    }
  };

  const handleUpdateItem = async (updatedItem: MistakeItem) => {
     try {
        setMistakes(prev => prev.map(m => m.id === updatedItem.id ? updatedItem : m));
        await firebaseService.updateMistake(user, updatedItem);
     } catch (e) {
         console.error("Failed to update item", e);
     }
  }

  const handleUpdateMastery = async (id: string, level: MasteryLevel) => {
    try {
        const updatedItem = mistakes.find(m => m.id === id);
        if (!updatedItem) return;

        const newItem = { ...updatedItem, mastery: level };
        
        setMistakes(prev => prev.map(m => 
          m.id === id ? newItem : m
        ));
        
        await firebaseService.updateMistake(user, newItem);
    } catch (e) {
        console.error("Failed to update mastery", e);
    }
  };

  const handleDeleteMistake = async (id: string) => {
      // Small vibration for mobile feedback
      if (navigator.vibrate) navigator.vibrate(50);
      
      if (window.confirm("この間違いノートを削除しますか？\n（この操作は元に戻せません）")) {
          try {
              const item = mistakes.find(m => m.id === id);
              setMistakes(prev => prev.filter(m => m.id !== id));
              await firebaseService.deleteMistake(user, id, item?.imageUrl);
          } catch (e) {
              console.error("Failed to delete item", e);
              alert("削除に失敗しました。");
              loadData(user);
          }
      }
  };

  // Filter Logic
  const filteredMistakes = useMemo(() => {
    return mistakes.filter(m => {
      const matchesSearch = m.questionText.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            m.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesSubject = selectedSubject === 'All' || m.subject === selectedSubject;
      const matchesMastery = filterMastery === 'All' || m.mastery === filterMastery;
      return matchesSearch && matchesSubject && matchesMastery;
    });
  }, [mistakes, searchTerm, selectedSubject, filterMastery]);

  if (isLoading) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
              <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <p className="text-slate-500 font-medium">読み込み中...</p>
              </div>
          </div>
      );
  }

  const NavItem = ({ id, icon: Icon, label, count }: { id: 'dashboard' | 'review', icon: any, label: string, count?: number }) => (
    <button 
      onClick={() => {
        setView(id);
        setIsMobileMenuOpen(false);
      }}
      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group ${
        view === id 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <Icon size={20} className={view === id ? 'text-white' : 'text-slate-400 group-hover:text-white transition-colors'} />
      <span className="font-medium">{label}</span>
      {count !== undefined && count > 0 && (
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
            view === id ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'
          }`}>{count}</span>
      )}
    </button>
  );

  return (
    <div className="min-h-screen flex bg-[#f8fafc] font-sans">
      
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-72 bg-[#0f172a] transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:flex-shrink-0 flex flex-col
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo Area */}
        <div className="p-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/20">
              <GraduationCap className="text-white" size={24} />
            </div>
            <div>
              <h1 className="font-bold text-xl text-white tracking-tight">SmartNote</h1>
              <p className="text-xs text-slate-500 font-medium">AI間違いノート</p>
            </div>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400">
            <X size={24} />
          </button>
        </div>

        {/* User Info / Login Status */}
        <div className="px-6 mb-4">
            {user ? (
                <div className="bg-slate-800 rounded-xl p-3 flex items-center gap-3 border border-slate-700">
                    {user.photoURL ? (
                        <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-slate-600" />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
                            {user.displayName ? user.displayName[0] : 'U'}
                        </div>
                    )}
                    <div className="flex-1 overflow-hidden">
                        <p className="text-xs text-slate-300 font-bold truncate">{user.displayName || 'ユーザー'}</p>
                        <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                            <Cloud size={10} /> クラウド同期中
                        </p>
                    </div>
                    <button onClick={handleLogout} className="text-slate-400 hover:text-white transition-colors" title="ログアウト">
                        <LogOut size={16} />
                    </button>
                </div>
            ) : (
                <button 
                    onClick={handleLogin}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white rounded-xl p-3 flex items-center justify-center gap-2 border border-slate-700 transition-colors"
                >
                    <LogIn size={18} className="text-indigo-400" />
                    <span className="text-sm font-medium">Googleでログイン</span>
                </button>
            )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-2">
          <NavItem id="dashboard" icon={BarChart2} label="データ分析" />
          <NavItem id="review" icon={BookOpen} label="間違いノート" count={mistakes.length} />
        </nav>

        {/* Bottom Action */}
        <div className="p-6 border-t border-slate-800/50 space-y-4">
           
           <button 
              onClick={() => {
                  setIsSettingsOpen(true);
                  setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
           >
              <Settings size={20} />
              <span className="font-medium">設定・データ管理</span>
           </button>

           <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 border border-slate-700/50">
              <h3 className="text-white font-medium text-sm mb-1">継続は力なり！</h3>
              <p className="text-slate-400 text-xs mb-3">間違いを追加して、分析を充実させましょう。</p>
              <button 
                onClick={() => {
                  setIsModalOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2.5 px-4 flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20 transition-all active:scale-95 font-medium text-sm"
              >
                <Plus size={18} />
                間違いを追加
              </button>
           </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden relative">
        {/* Top Header Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-indigo-50/50 to-transparent pointer-events-none" />

        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-100 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <GraduationCap className="text-white" size={18} />
            </div>
            <span className="font-bold text-slate-800">SmartNote</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 bg-slate-100 rounded-lg">
            <Menu size={24} />
          </button>
        </div>
        
        <div className="max-w-7xl mx-auto p-4 md:p-10 relative z-0">
            {view === 'dashboard' && <Dashboard mistakes={mistakes} />}

            {view === 'review' && (
                <div className="space-y-8 animate-fade-in">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                        <div>
                             <h2 className="text-3xl font-bold text-slate-900 tracking-tight">マイノート</h2>
                             <p className="text-slate-500 mt-2 text-lg">知識の隙間を埋めて、苦手を克服しましょう。</p>
                        </div>
                        
                        {/* Filters */}
                        <div className="flex flex-wrap gap-3 items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm w-full md:w-auto">
                            <div className="relative flex-grow md:flex-grow-0">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="検索..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-2.5 bg-transparent rounded-lg text-sm focus:bg-slate-50 outline-none w-full md:w-56 text-slate-700 placeholder-slate-400"
                                />
                            </div>
                            
                            <div className="h-6 w-px bg-slate-200 hidden md:block"></div>

                            <select 
                                value={selectedSubject}
                                onChange={(e) => setSelectedSubject(e.target.value as any)}
                                className="px-3 py-2.5 bg-transparent hover:bg-slate-50 rounded-lg text-sm outline-none text-slate-700 font-medium cursor-pointer"
                            >
                                <option value="All">全科目</option>
                                {Object.values(Subject).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>

                             <select 
                                value={filterMastery}
                                onChange={(e) => setFilterMastery(e.target.value as any)}
                                className="px-3 py-2.5 bg-transparent hover:bg-slate-50 rounded-lg text-sm outline-none text-slate-700 font-medium cursor-pointer"
                            >
                                <option value="All">全ステータス</option>
                                {Object.values(MasteryLevel).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    {filteredMistakes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-dashed border-slate-200 text-center shadow-sm">
                            <div className="bg-slate-50 p-6 rounded-full mb-6 ring-8 ring-slate-50/50">
                                <Filter className="text-slate-300" size={40} />
                            </div>
                            <h3 className="text-xl font-semibold text-slate-900 mb-2">間違いが見つかりません</h3>
                            <p className="text-slate-500 max-w-sm mx-auto mb-8">
                                {user ? "クラウドにはまだデータがありません。" : "現在のフィルターに一致する問題はありません。"}
                            </p>
                            <button 
                                onClick={() => setIsModalOpen(true)}
                                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium shadow-md shadow-indigo-200 transition-all active:scale-95"
                            >
                                最初の間違いを追加する
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-6">
                            {filteredMistakes.map(item => (
                                <ReviewCard 
                                    key={item.id} 
                                    item={item} 
                                    onUpdateMastery={handleUpdateMastery} 
                                    onUpdateItem={handleUpdateItem}
                                    onDelete={handleDeleteMistake}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
      </main>

      {/* Modals */}
      <AddMistakeModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleAddMistake}
      />

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        mistakes={mistakes}
        onDataChanged={() => loadData(user)}
      />

    </div>
  );
};

export default App;
