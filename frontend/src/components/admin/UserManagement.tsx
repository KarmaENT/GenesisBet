'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  MagnifyingGlassIcon,
  FunnelIcon,
  EyeIcon,
  PencilIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [kycFilter, setKycFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);

  // Mock data - in production this would come from API
  const mockUsers = [
    {
      id: '1',
      username: 'Player123',
      email: 'player123@example.com',
      status: 'active',
      kyc: { status: 'approved', level: 2 },
      vip: { level: 3, points: 15420 },
      wallet: { balance: { USD: 1250.50, BTC: 0.0234 } },
      createdAt: '2024-01-15T10:30:00Z',
      lastLogin: '2024-06-22T08:15:00Z',
      totalDeposits: 5420.30,
      totalWithdrawals: 3890.20,
      gamesPlayed: 1247,
      country: 'US'
    },
    {
      id: '2',
      username: 'CryptoKing',
      email: 'cryptoking@example.com',
      status: 'active',
      kyc: { status: 'pending', level: 1 },
      vip: { level: 1, points: 2340 },
      wallet: { balance: { USD: 890.75, ETH: 0.45 } },
      createdAt: '2024-02-20T14:22:00Z',
      lastLogin: '2024-06-22T07:45:00Z',
      totalDeposits: 2340.00,
      totalWithdrawals: 1450.25,
      gamesPlayed: 567,
      country: 'CA'
    },
    {
      id: '3',
      username: 'HighRoller',
      email: 'highroller@example.com',
      status: 'suspended',
      kyc: { status: 'approved', level: 3 },
      vip: { level: 5, points: 45890 },
      wallet: { balance: { USD: 15420.80, BTC: 0.234 } },
      createdAt: '2023-11-10T09:15:00Z',
      lastLogin: '2024-06-21T23:30:00Z',
      totalDeposits: 89420.50,
      totalWithdrawals: 74000.70,
      gamesPlayed: 5678,
      country: 'UK'
    },
    {
      id: '4',
      username: 'NewUser456',
      email: 'newuser456@example.com',
      status: 'active',
      kyc: { status: 'rejected', level: 0 },
      vip: { level: 0, points: 120 },
      wallet: { balance: { USD: 100.00 } },
      createdAt: '2024-06-20T16:45:00Z',
      lastLogin: '2024-06-22T06:20:00Z',
      totalDeposits: 100.00,
      totalWithdrawals: 0,
      gamesPlayed: 23,
      country: 'DE'
    }
  ];

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setUsers(mockUsers);
      setLoading(false);
    }, 1000);
  }, []);

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    const matchesKyc = kycFilter === 'all' || user.kyc.status === kycFilter;
    
    return matchesSearch && matchesStatus && matchesKyc;
  });

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-600/20 text-green-400',
      suspended: 'bg-yellow-600/20 text-yellow-400',
      banned: 'bg-red-600/20 text-red-400'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getKycBadge = (kycStatus) => {
    const styles = {
      approved: { bg: 'bg-green-600/20 text-green-400', icon: CheckCircleIcon },
      pending: { bg: 'bg-yellow-600/20 text-yellow-400', icon: ClockIcon },
      rejected: { bg: 'bg-red-600/20 text-red-400', icon: XCircleIcon }
    };
    
    const style = styles[kycStatus];
    const Icon = style.icon;
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center space-x-1 ${style.bg}`}>
        <Icon className="w-3 h-3" />
        <span>{kycStatus.charAt(0).toUpperCase() + kycStatus.slice(1)}</span>
      </span>
    );
  };

  const getVipBadge = (level) => {
    const colors = {
      0: 'bg-gray-600/20 text-gray-400',
      1: 'bg-amber-600/20 text-amber-400',
      2: 'bg-gray-400/20 text-gray-300',
      3: 'bg-yellow-500/20 text-yellow-400',
      4: 'bg-purple-600/20 text-purple-400',
      5: 'bg-blue-500/20 text-blue-400'
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[level] || colors[0]}`}>
        VIP {level}
      </span>
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount, currency) => {
    if (currency === 'USD') {
      return `$${amount.toLocaleString()}`;
    }
    return `${amount.toFixed(4)} ${currency}`;
  };

  const UserModal = ({ user, onClose }) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-gray-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">User Details: {user.username}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <XCircleIcon className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Basic Information</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Username:</span>
                  <span className="font-semibold">{user.username}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Email:</span>
                  <span className="font-semibold">{user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  {getStatusBadge(user.status)}
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Country:</span>
                  <span className="font-semibold">{user.country}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Joined:</span>
                  <span className="font-semibold">{formatDate(user.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Last Login:</span>
                  <span className="font-semibold">{formatDate(user.lastLogin)}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Verification & VIP</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">KYC Status:</span>
                  {getKycBadge(user.kyc.status)}
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">KYC Level:</span>
                  <span className="font-semibold">Level {user.kyc.level}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">VIP Status:</span>
                  {getVipBadge(user.vip.level)}
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">VIP Points:</span>
                  <span className="font-semibold">{user.vip.points.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Wallet Balance */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Wallet Balance</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(user.wallet.balance).map(([currency, amount]) => (
                <div key={currency} className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-sm text-gray-400">{currency}</div>
                  <div className="text-lg font-bold">{formatCurrency(amount, currency)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity Stats */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Activity Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-sm text-gray-400">Total Deposits</div>
                <div className="text-lg font-bold text-green-400">
                  ${user.totalDeposits.toLocaleString()}
                </div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-sm text-gray-400">Total Withdrawals</div>
                <div className="text-lg font-bold text-red-400">
                  ${user.totalWithdrawals.toLocaleString()}
                </div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-sm text-gray-400">Net Deposits</div>
                <div className="text-lg font-bold text-purple-400">
                  ${(user.totalDeposits - user.totalWithdrawals).toLocaleString()}
                </div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="text-sm text-gray-400">Games Played</div>
                <div className="text-lg font-bold text-blue-400">
                  {user.gamesPlayed.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4 pt-4 border-t border-gray-700">
            <button className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-semibold transition-colors">
              Edit User
            </button>
            <button className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-lg font-semibold transition-colors">
              Suspend Account
            </button>
            <button className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold transition-colors">
              Approve KYC
            </button>
            <button className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-semibold transition-colors">
              Ban User
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">User Management</h2>
        <div className="text-sm text-gray-400">
          {filteredUsers.length} of {users.length} users
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by username or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
        </select>

        {/* KYC Filter */}
        <select
          value={kycFilter}
          onChange={(e) => setKycFilter(e.target.value)}
          className="px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
        >
          <option value="all">All KYC</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="loading-spinner w-8 h-8 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading users...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="text-left p-4 font-semibold">User</th>
                  <th className="text-left p-4 font-semibold">Status</th>
                  <th className="text-left p-4 font-semibold">KYC</th>
                  <th className="text-left p-4 font-semibold">VIP</th>
                  <th className="text-left p-4 font-semibold">Balance</th>
                  <th className="text-left p-4 font-semibold">Activity</th>
                  <th className="text-left p-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, index) => (
                  <motion.tr
                    key={user.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className="border-t border-gray-700 hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="p-4">
                      <div>
                        <div className="font-semibold">{user.username}</div>
                        <div className="text-sm text-gray-400">{user.email}</div>
                        <div className="text-xs text-gray-500">
                          Joined {formatDate(user.createdAt)}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      {getStatusBadge(user.status)}
                    </td>
                    <td className="p-4">
                      {getKycBadge(user.kyc.status)}
                    </td>
                    <td className="p-4">
                      {getVipBadge(user.vip.level)}
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        {Object.entries(user.wallet.balance).slice(0, 2).map(([currency, amount]) => (
                          <div key={currency} className="text-sm">
                            {formatCurrency(amount, currency)}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm space-y-1">
                        <div>Games: {user.gamesPlayed}</div>
                        <div className="text-gray-400">
                          Last: {formatDate(user.lastLogin)}
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex space-x-2">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            setSelectedUser(user);
                            setShowUserModal(true);
                          }}
                          className="p-2 bg-purple-600/20 text-purple-400 rounded-lg hover:bg-purple-600/30 transition-colors"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </motion.button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      {showUserModal && selectedUser && (
        <UserModal
          user={selectedUser}
          onClose={() => {
            setShowUserModal(false);
            setSelectedUser(null);
          }}
        />
      )}
    </div>
  );
};

export default UserManagement;

