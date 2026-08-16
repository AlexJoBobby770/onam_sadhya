import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { BarChart3, Users, Ticket, CheckCircle2, Download, UserCheck, RefreshCw, DollarSign } from 'lucide-react';

export const SuperAdminDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [analyticsRes, usersRes] = await Promise.all([
        api.get('/admin/analytics'),
        api.get('/admin/users')
      ]);
      setAnalytics(analyticsRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      console.error('Failed to fetch super admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    setUpdatingUserId(userId);
    try {
      await api.post(`/admin/users/${userId}/role`, { role: newRole });
      fetchData();
    } catch (err) {
      alert('Failed to update user role: ' + (err.response?.data?.detail || err.message));
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleExportCSV = () => {
    window.open('/api/admin/export', '_blank');
  };

  if (loading) {
    return <div className="text-center py-12 text-onam-muted-dim text-sm">Loading super admin analytics...</div>;
  }

  const gateScanRate = analytics?.approved_tickets > 0 
    ? ((analytics.scanned_tickets / analytics.approved_tickets) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      
      {/* Header & Export Action */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-onam-deep border border-onam-line p-6 rounded-2xl">
        <div>
          <h2 className="text-2xl font-bold text-onam-kasavu flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-onam-gold" />
            <span>Super Admin Operations & Analytics</span>
          </h2>
          <p className="text-xs text-onam-muted mt-1">System status overview, role management, and attendance exports.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl bg-onam-black border border-onam-line text-onam-muted hover:text-onam-kasavu transition"
            title="Refresh Analytics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={handleExportCSV}
            className="btn-gold px-4 py-2.5 text-xs flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV Report</span>
          </button>
        </div>
      </div>

      {/* ANALYTICS STAT CARDS */}
      {analytics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="bg-onam-deep p-5 rounded-xl border border-onam-line space-y-2">
            <div className="flex items-center justify-between text-emerald-400">
              <span className="text-xs font-bold uppercase tracking-wider">Total Revenue</span>
              <DollarSign className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-onam-kasavu font-mono">₹{analytics.total_revenue.toLocaleString()}</p>
            <p className="text-[11px] text-onam-muted">{analytics.approved_tickets} approved tickets @ ₹250</p>
          </div>

          <div className="bg-onam-deep p-5 rounded-xl border border-onam-line space-y-2">
            <div className="flex items-center justify-between text-onam-muted">
              <span className="text-xs font-bold uppercase tracking-wider">Approved Passes</span>
              <Ticket className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-onam-kasavu font-mono">{analytics.approved_tickets}</p>
            <p className="text-[11px] text-onam-muted">{analytics.pending_tickets} pending review</p>
          </div>

          <div className="bg-onam-deep p-5 rounded-xl border border-onam-line space-y-2">
            <div className="flex items-center justify-between text-emerald-400">
              <span className="text-xs font-bold uppercase tracking-wider">Gate Scanned</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-onam-kasavu font-mono">{analytics.scanned_tickets}</p>
            <p className="text-[11px] text-onam-muted">{gateScanRate}% scanned at venue</p>
          </div>

          <div className="bg-onam-deep p-5 rounded-xl border border-onam-line space-y-2">
            <div className="flex items-center justify-between text-onam-muted">
              <span className="text-xs font-bold uppercase tracking-wider">Registered Users</span>
              <Users className="w-4 h-4" />
            </div>
            <p className="text-2xl font-bold text-onam-kasavu font-mono">{analytics.total_users}</p>
            <p className="text-[11px] text-onam-muted">{analytics.total_admins} admins/volunteers</p>
          </div>

        </div>
      )}

      {/* USER ROLE MANAGEMENT TABLE */}
      <div className="bg-onam-deep border border-onam-line p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-onam-kasavu flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-onam-gold" />
            <span>User Accounts & Permissions</span>
          </h3>
          <span className="text-xs text-onam-muted">{users.length} Users</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-onam-line">
          <table className="w-full text-left text-xs">
            <thead className="bg-onam-black text-onam-muted font-semibold uppercase tracking-wider border-b border-onam-line">
              <tr>
                <th className="p-3.5">Name</th>
                <th className="p-3.5">Phone</th>
                <th className="p-3.5">Roll No</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-onam-line/60 font-mono">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-onam-black/40 transition">
                  <td className="p-3.5 font-sans font-bold text-onam-kasavu">{u.name}</td>
                  <td className="p-3.5 text-onam-muted">{u.phone}</td>
                  <td className="p-3.5 text-onam-muted">{u.roll_no || 'N/A'}</td>
                  <td className="p-3.5">
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      u.role === 'super_admin' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                      u.role === 'admin' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                      'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3.5 text-right font-sans">
                    {u.role !== 'super_admin' && (
                      <div className="flex items-center justify-end gap-1.5">
                        {u.role === 'student' ? (
                          <button
                            onClick={() => handleRoleChange(u.id, 'admin')}
                            disabled={updatingUserId === u.id}
                            className="px-2.5 py-1 rounded-lg bg-onam-gold/15 border border-onam-gold/40 text-onam-gold font-semibold text-[11px] hover:bg-onam-gold/25 transition"
                          >
                            Make Admin
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRoleChange(u.id, 'student')}
                            disabled={updatingUserId === u.id}
                            className="px-2.5 py-1 rounded-lg bg-onam-raised text-onam-muted font-semibold text-[11px] hover:bg-onam-line transition"
                          >
                            Demote to Student
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
