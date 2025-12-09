"use client";

import React, { useState } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';
import { 
  LayoutDashboard, Users, Settings, Bell, Menu, Search, Activity, DollarSign
} from 'lucide-react';

// Define the data shape we expect from the Server
interface UserData {
  id: number;
  email: string;
  name: string | null;
}

interface DashboardProps {
  totalUsers: number;
  recentUsers: UserData[];
}

// Keep chart mock data for now
const revenueData = [
  { name: 'Mon', value: 4000 }, { name: 'Tue', value: 3000 },
  { name: 'Wed', value: 2000 }, { name: 'Thu', value: 2780 },
  { name: 'Fri', value: 1890 }, { name: 'Sat', value: 2390 },
  { name: 'Sun', value: 3490 },
];

const activityData = [
  { name: '00:00', value: 12 }, { name: '04:00', value: 8 },
  { name: '08:00', value: 45 }, { name: '12:00', value: 90 },
  { name: '16:00', value: 75 }, { name: '20:00', value: 30 },
];

export default function DashboardClient({ totalUsers, recentUsers }: DashboardProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  const StatCard = ({ title, value, icon: Icon, trend, trendUp }: any) => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-2">{value}</h3>
        </div>
        <div className={`p-3 rounded-lg ${trendUp ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          <Icon size={20} />
        </div>
      </div>
      <div className="mt-4 flex items-center text-sm">
        <span className={trendUp ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
          {trend}
        </span>
        <span className="text-slate-400 ml-2">vs last month</span>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-slate-800">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Activity className="text-blue-500" />
              GameGalaxy TEST4
            </h1>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-2">
            <button onClick={() => setActiveTab('overview')} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium bg-blue-600 text-white">
              <LayoutDashboard size={20} /> Overview
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800">
              <Users size={20} /> Users
            </button>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Menu size={20} /></button>
              <div className="hidden md:flex items-center gap-2 text-slate-400 bg-slate-100 px-3 py-2 rounded-lg w-64"><Search size={18} /><input type="text" placeholder="Search..." className="bg-transparent border-none focus:outline-none text-sm w-full text-slate-900"/></div>
            </div>
            <div className="flex items-center gap-4"><button className="p-2 text-slate-400 hover:bg-slate-100 rounded-full relative"><Bell size={20} /></button></div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard title="Total Revenue" value="$54,230" icon={DollarSign} trend="+12.5%" trendUp={true} />
              
              {/* --- THIS IS REAL DATA --- */}
              <StatCard 
                title="Registered Users" 
                value={totalUsers} 
                icon={Users} 
                trend="+100%" 
                trendUp={true} 
              />
              {/* ------------------------- */}

              <StatCard title="Bounce Rate" value="42.3%" icon={Activity} trend="-2.1%" trendUp={true} />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Revenue Overview</h3>
                <div className="h-80"><ResponsiveContainer width="100%" height="100%"><LineChart data={revenueData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} /><YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} /><Tooltip /><Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={3} dot={{fill: '#2563eb'}} /></LineChart></ResponsiveContainer></div>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Daily Traffic</h3>
                <div className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={activityData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b'}} /><YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} /><Tooltip /><Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
              </div>
            </div>

            {/* --- REAL DATABASE TABLE --- */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-800">Recent Database Users</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-medium">ID</th>
                      <th className="px-6 py-4 font-medium">Name</th>
                      <th className="px-6 py-4 font-medium">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900">#{user.id}</td>
                        <td className="px-6 py-4 text-slate-500">{user.name || 'No Name'}</td>
                        <td className="px-6 py-4 text-slate-900">{user.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}