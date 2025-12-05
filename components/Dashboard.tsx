
import React from 'react';
import { MistakeItem, Language } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { BookOpen, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';
import { t, getSubjectLabel, getMasteryLabel } from '../utils/translations';

interface DashboardProps {
  mistakes: MistakeItem[];
  language: Language;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const Dashboard: React.FC<DashboardProps> = ({ mistakes, language }) => {
  
  // Prepare data for Pie Chart (Subjects)
  const subjectCounts = mistakes.reduce((acc, curr) => {
    // Map the stored subject key to the translated label for aggregation
    const label = getSubjectLabel(curr.subject, language);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.keys(subjectCounts).map(subject => ({
    name: subject,
    value: subjectCounts[subject]
  }));

  // Prepare data for Mastery Bar Chart
  const masteryCounts = mistakes.reduce((acc, curr) => {
    const label = getMasteryLabel(curr.mastery, language);
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const barData = Object.keys(masteryCounts).map(level => ({
    name: level,
    value: masteryCounts[level]
  }));

  const totalMistakes = mistakes.length;
  const masteredCount = mistakes.filter(m => m.mastery === '完了').length;
  const reviewingCount = totalMistakes - masteredCount;

  const StatCard = ({ icon: Icon, label, value, colorClass, bgClass }: any) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between group hover:shadow-md transition-all duration-300">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
        <p className="text-3xl font-bold text-slate-800 tracking-tight">{value}</p>
      </div>
      <div className={`p-3 rounded-xl ${bgClass} ${colorClass} group-hover:scale-110 transition-transform duration-300`}>
        <Icon size={24} />
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">{t('stats_analysis', language)}</h2>
        <p className="text-slate-500 mt-2 text-lg">{t('stats_desc', language)}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
            icon={BookOpen} 
            label={t('total_mistakes', language)}
            value={totalMistakes} 
            colorClass="text-indigo-600" 
            bgClass="bg-indigo-50" 
        />
        <StatCard 
            icon={CheckCircle} 
            label={t('mastered', language)} 
            value={masteredCount} 
            colorClass="text-emerald-600" 
            bgClass="bg-emerald-50" 
        />
        <StatCard 
            icon={AlertCircle} 
            label={t('review_needed', language)} 
            value={reviewingCount} 
            colorClass="text-amber-600" 
            bgClass="bg-amber-50" 
        />
      </div>

      {/* Charts */}
      {totalMistakes > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-bold text-slate-800">{t('subject_breakdown', language)}</h3>
            </div>
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={6}
                    dataKey="value"
                    stroke="none"
                    cornerRadius={6}
                    >
                    {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                    </Pie>
                    <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ color: '#1e293b', fontWeight: 600 }}
                    />
                </PieChart>
                </ResponsiveContainer>
            </div>
            {/* Custom Legend */}
            <div className="flex flex-wrap gap-4 justify-center mt-4">
                {pieData.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span className="text-sm text-slate-600 font-medium">{entry.name}</span>
                    </div>
                ))}
            </div>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
             <div className="flex items-center justify-between mb-8">
                <h3 className="text-lg font-bold text-slate-800">{t('mastery_status', language)}</h3>
            </div>
            <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} barSize={60}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#64748b', fontSize: 12}} 
                        dy={10}
                    />
                    <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#64748b', fontSize: 12}} 
                        allowDecimals={false}
                    />
                    <Tooltip 
                        cursor={{fill: '#f1f5f9', radius: 8}}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ color: '#1e293b', fontWeight: 600 }}
                    />
                    <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 8, 8]} />
                </BarChart>
                </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-slate-200">
           <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
               <TrendingUp className="text-slate-300" size={32} />
           </div>
          <p className="text-slate-400 font-medium">{t('no_mistakes_yet', language)}</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
