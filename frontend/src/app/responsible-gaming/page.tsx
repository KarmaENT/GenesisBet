'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ShieldCheckIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  PhoneIcon,
  GlobeAltIcon,
  HeartIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

const ResponsibleGaming = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [limits, setLimits] = useState({
    dailyDeposit: 1000,
    dailyWithdrawal: 5000,
    sessionTime: 120
  });
  const [selfAssessment, setSelfAssessment] = useState({
    answers: new Array(8).fill(false),
    completed: false,
    score: 0,
    riskLevel: 'low'
  });
  const [showSelfExclusionModal, setShowSelfExclusionModal] = useState(false);
  const [exclusionType, setExclusionType] = useState('cooling-off');
  const [exclusionDuration, setExclusionDuration] = useState(24);

  const tabs = [
    { id: 'overview', name: 'Overview', icon: InformationCircleIcon },
    { id: 'limits', name: 'Set Limits', icon: ShieldCheckIcon },
    { id: 'assessment', name: 'Self-Assessment', icon: HeartIcon },
    { id: 'exclusion', name: 'Self-Exclusion', icon: ExclamationTriangleIcon },
    { id: 'resources', name: 'Get Help', icon: PhoneIcon }
  ];

  const assessmentQuestions = [
    'Do you spend more time or money gambling than you can afford?',
    'Do you need to gamble with increasing amounts of money to get the same excitement?',
    'Have you tried to stop gambling but been unable to do so?',
    'Do you feel restless or irritable when trying to cut down on gambling?',
    'Do you gamble to escape problems or negative feelings?',
    'After losing money gambling, do you often return to try to win back your losses?',
    'Have you lied to family members or others about your gambling activities?',
    'Has gambling caused problems in your relationships, work, or finances?'
  ];

  const helpResources = [
    {
      name: 'National Problem Gambling Helpline',
      phone: '1-800-522-4700',
      website: 'ncpgambling.org',
      description: '24/7 confidential support for problem gambling',
      available: '24/7'
    },
    {
      name: 'Gamblers Anonymous',
      phone: '1-855-222-5542',
      website: 'gamblersanonymous.org',
      description: 'Fellowship of people who share their experience with gambling addiction',
      available: 'Meetings available'
    },
    {
      name: 'GamCare (UK)',
      phone: '0808 8020 133',
      website: 'gamcare.org.uk',
      description: 'UK-based gambling support and information service',
      available: '24/7'
    },
    {
      name: 'BeGambleAware',
      phone: '0808 8020 133',
      website: 'begambleaware.org',
      description: 'Independent charity providing information and advice',
      available: 'Online resources'
    }
  ];

  const handleLimitChange = (type, value) => {
    setLimits(prev => ({
      ...prev,
      [type]: value
    }));
  };

  const handleAssessmentAnswer = (questionIndex, answer) => {
    const newAnswers = [...selfAssessment.answers];
    newAnswers[questionIndex] = answer;
    
    const score = newAnswers.filter(a => a === true).length;
    let riskLevel;
    
    if (score <= 2) riskLevel = 'low';
    else if (score <= 4) riskLevel = 'moderate';
    else if (score <= 6) riskLevel = 'high';
    else riskLevel = 'very_high';

    setSelfAssessment({
      answers: newAnswers,
      completed: true,
      score,
      riskLevel
    });
  };

  const getRiskLevelColor = (level) => {
    switch (level) {
      case 'low': return 'text-green-400';
      case 'moderate': return 'text-yellow-400';
      case 'high': return 'text-orange-400';
      case 'very_high': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getRiskLevelBg = (level) => {
    switch (level) {
      case 'low': return 'bg-green-600/20';
      case 'moderate': return 'bg-yellow-600/20';
      case 'high': return 'bg-orange-600/20';
      case 'very_high': return 'bg-red-600/20';
      default: return 'bg-gray-600/20';
    }
  };

  const SelfExclusionModal = () => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-gray-800 rounded-xl max-w-2xl w-full p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-red-400">Self-Exclusion</h2>
          <button
            onClick={() => setShowSelfExclusionModal(false)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <XCircleIcon className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-6">
          <div className="bg-red-600/20 border border-red-600/30 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <ExclamationTriangleIcon className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-400 mb-2">Important Warning</h3>
                <p className="text-sm text-gray-300">
                  Self-exclusion will prevent you from accessing your account and gambling on our platform. 
                  This action cannot be easily reversed and is designed to help you take control of your gambling.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-3">Exclusion Type</label>
            <div className="space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="exclusionType"
                  value="cooling-off"
                  checked={exclusionType === 'cooling-off'}
                  onChange={(e) => setExclusionType(e.target.value)}
                  className="text-purple-600"
                />
                <div>
                  <div className="font-medium">Cooling-off Period</div>
                  <div className="text-sm text-gray-400">Take a short break (24 hours to 6 weeks)</div>
                </div>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="exclusionType"
                  value="temporary"
                  checked={exclusionType === 'temporary'}
                  onChange={(e) => setExclusionType(e.target.value)}
                  className="text-purple-600"
                />
                <div>
                  <div className="font-medium">Temporary Self-Exclusion</div>
                  <div className="text-sm text-gray-400">Exclude yourself for 6 months to 5 years</div>
                </div>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="exclusionType"
                  value="permanent"
                  checked={exclusionType === 'permanent'}
                  onChange={(e) => setExclusionType(e.target.value)}
                  className="text-purple-600"
                />
                <div>
                  <div className="font-medium text-red-400">Permanent Self-Exclusion</div>
                  <div className="text-sm text-gray-400">Permanently exclude yourself from gambling</div>
                </div>
              </label>
            </div>
          </div>

          {exclusionType !== 'permanent' && (
            <div>
              <label className="block text-sm font-medium mb-3">
                Duration ({exclusionType === 'cooling-off' ? 'hours' : 'days'})
              </label>
              <input
                type="number"
                value={exclusionDuration}
                onChange={(e) => setExclusionDuration(parseInt(e.target.value))}
                min={exclusionType === 'cooling-off' ? 24 : 180}
                max={exclusionType === 'cooling-off' ? 1008 : 1825}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                {exclusionType === 'cooling-off' 
                  ? 'Minimum 24 hours, maximum 6 weeks (1008 hours)'
                  : 'Minimum 6 months (180 days), maximum 5 years (1825 days)'
                }
              </p>
            </div>
          )}

          <div className="flex space-x-4 pt-4 border-t border-gray-700">
            <button
              onClick={() => setShowSelfExclusionModal(false)}
              className="flex-1 bg-gray-600 hover:bg-gray-500 px-4 py-3 rounded-lg font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              className="flex-1 bg-red-600 hover:bg-red-700 px-4 py-3 rounded-lg font-semibold transition-colors"
            >
              Apply Self-Exclusion
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Responsible Gaming</h1>
        <p className="text-gray-400">Take control of your gaming experience with our responsible gaming tools</p>
      </div>

      {/* Tabs */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2 bg-gray-800 rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              <span>{tab.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-8">
        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">What is Responsible Gaming?</h2>
              <p className="text-gray-300 mb-4">
                Responsible gaming means gambling in a way that is fun and entertaining while staying in control. 
                It's about making informed decisions and setting limits to ensure gambling remains a form of entertainment, 
                not a problem.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <ShieldCheckIcon className="w-8 h-8 text-purple-400 mb-3" />
                  <h3 className="font-semibold mb-2">Set Limits</h3>
                  <p className="text-sm text-gray-400">Control your spending and time with deposit and session limits</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <ClockIcon className="w-8 h-8 text-blue-400 mb-3" />
                  <h3 className="font-semibold mb-2">Take Breaks</h3>
                  <p className="text-sm text-gray-400">Regular breaks help maintain perspective and control</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <HeartIcon className="w-8 h-8 text-red-400 mb-3" />
                  <h3 className="font-semibold mb-2">Get Help</h3>
                  <p className="text-sm text-gray-400">Professional support is available if you need it</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-xl p-6 border border-purple-500/30">
              <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setActiveTab('limits')}
                  className="bg-gray-800/50 hover:bg-gray-700/50 p-4 rounded-lg text-left transition-colors"
                >
                  <CurrencyDollarIcon className="w-6 h-6 text-green-400 mb-2" />
                  <div className="font-semibold">Set Deposit Limits</div>
                  <div className="text-sm text-gray-400">Control your daily spending</div>
                </button>
                <button
                  onClick={() => setActiveTab('assessment')}
                  className="bg-gray-800/50 hover:bg-gray-700/50 p-4 rounded-lg text-left transition-colors"
                >
                  <HeartIcon className="w-6 h-6 text-red-400 mb-2" />
                  <div className="font-semibold">Take Self-Assessment</div>
                  <div className="text-sm text-gray-400">Check your gambling habits</div>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'limits' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Set Your Limits</h2>
              <p className="text-gray-400 mb-6">
                Setting limits helps you stay in control of your gambling. These limits will be enforced immediately.
              </p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-3">Daily Deposit Limit ($)</label>
                  <input
                    type="number"
                    value={limits.dailyDeposit}
                    onChange={(e) => handleLimitChange('dailyDeposit', parseInt(e.target.value))}
                    min="10"
                    max="50000"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Maximum amount you can deposit in 24 hours</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-3">Daily Withdrawal Limit ($)</label>
                  <input
                    type="number"
                    value={limits.dailyWithdrawal}
                    onChange={(e) => handleLimitChange('dailyWithdrawal', parseInt(e.target.value))}
                    min="100"
                    max="100000"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Maximum amount you can withdraw in 24 hours</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-3">Session Time Limit (minutes)</label>
                  <input
                    type="number"
                    value={limits.sessionTime}
                    onChange={(e) => handleLimitChange('sessionTime', parseInt(e.target.value))}
                    min="30"
                    max="1440"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  />
                  <p className="text-xs text-gray-400 mt-1">Maximum time you can play in one session</p>
                </div>

                <button className="w-full bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-semibold transition-colors">
                  Update Limits
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'assessment' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Problem Gambling Self-Assessment</h2>
              <p className="text-gray-400 mb-6">
                Answer these questions honestly to assess your gambling habits. This assessment is confidential and designed to help you.
              </p>

              <div className="space-y-4">
                {assessmentQuestions.map((question, index) => (
                  <div key={index} className="bg-gray-700/50 rounded-lg p-4">
                    <p className="font-medium mb-3">{index + 1}. {question}</p>
                    <div className="flex space-x-4">
                      <button
                        onClick={() => handleAssessmentAnswer(index, false)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          selfAssessment.answers[index] === false
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                        }`}
                      >
                        No
                      </button>
                      <button
                        onClick={() => handleAssessmentAnswer(index, true)}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          selfAssessment.answers[index] === true
                            ? 'bg-red-600 text-white'
                            : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                        }`}
                      >
                        Yes
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {selfAssessment.completed && (
                <div className={`mt-6 p-4 rounded-lg ${getRiskLevelBg(selfAssessment.riskLevel)}`}>
                  <h3 className="font-semibold mb-2">Assessment Results</h3>
                  <p className="mb-2">
                    Score: {selfAssessment.score}/8 - 
                    <span className={`font-semibold ml-1 ${getRiskLevelColor(selfAssessment.riskLevel)}`}>
                      {selfAssessment.riskLevel.replace('_', ' ').toUpperCase()} RISK
                    </span>
                  </p>
                  <div className="text-sm">
                    {selfAssessment.riskLevel === 'low' && (
                      <p>Continue to gamble responsibly. Set limits to maintain control.</p>
                    )}
                    {selfAssessment.riskLevel === 'moderate' && (
                      <p>Consider setting stricter limits and taking regular breaks.</p>
                    )}
                    {selfAssessment.riskLevel === 'high' && (
                      <p>We recommend seeking professional help and considering self-exclusion.</p>
                    )}
                    {selfAssessment.riskLevel === 'very_high' && (
                      <p>Please contact our support team immediately and consider self-exclusion.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'exclusion' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Self-Exclusion Options</h2>
              <p className="text-gray-400 mb-6">
                Self-exclusion tools help you take a break from gambling when you need it most.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-600/20 border border-blue-600/30 rounded-lg p-4">
                  <ClockIcon className="w-8 h-8 text-blue-400 mb-3" />
                  <h3 className="font-semibold mb-2">Cooling-off Period</h3>
                  <p className="text-sm text-gray-400 mb-4">Take a short break from 24 hours to 6 weeks</p>
                  <button
                    onClick={() => {
                      setExclusionType('cooling-off');
                      setShowSelfExclusionModal(true);
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Start Cooling-off
                  </button>
                </div>

                <div className="bg-yellow-600/20 border border-yellow-600/30 rounded-lg p-4">
                  <ShieldCheckIcon className="w-8 h-8 text-yellow-400 mb-3" />
                  <h3 className="font-semibold mb-2">Temporary Exclusion</h3>
                  <p className="text-sm text-gray-400 mb-4">Exclude yourself for 6 months to 5 years</p>
                  <button
                    onClick={() => {
                      setExclusionType('temporary');
                      setShowSelfExclusionModal(true);
                    }}
                    className="w-full bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Apply Exclusion
                  </button>
                </div>

                <div className="bg-red-600/20 border border-red-600/30 rounded-lg p-4">
                  <ExclamationTriangleIcon className="w-8 h-8 text-red-400 mb-3" />
                  <h3 className="font-semibold mb-2">Permanent Exclusion</h3>
                  <p className="text-sm text-gray-400 mb-4">Permanently exclude yourself from gambling</p>
                  <button
                    onClick={() => {
                      setExclusionType('permanent');
                      setShowSelfExclusionModal(true);
                    }}
                    className="w-full bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-medium transition-colors"
                  >
                    Permanent Exclusion
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'resources' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
              <h2 className="text-xl font-semibold mb-4">Get Help & Support</h2>
              <p className="text-gray-400 mb-6">
                If you're concerned about your gambling, help is available. These organizations provide free, confidential support.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {helpResources.map((resource, index) => (
                  <div key={index} className="bg-gray-700/50 rounded-lg p-4">
                    <h3 className="font-semibold mb-2">{resource.name}</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2">
                        <PhoneIcon className="w-4 h-4 text-green-400" />
                        <span className="font-mono">{resource.phone}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <GlobeAltIcon className="w-4 h-4 text-blue-400" />
                        <span>{resource.website}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <ClockIcon className="w-4 h-4 text-purple-400" />
                        <span>{resource.available}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-3">{resource.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-r from-red-600/20 to-orange-600/20 rounded-xl p-6 border border-red-500/30">
              <h3 className="text-lg font-semibold mb-4">Warning Signs of Problem Gambling</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <ul className="space-y-2">
                  <li className="flex items-start space-x-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>Gambling with money you can't afford to lose</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>Chasing losses with bigger bets</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>Lying about gambling activities</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>Neglecting work, family, or responsibilities</span>
                  </li>
                </ul>
                <ul className="space-y-2">
                  <li className="flex items-start space-x-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>Feeling anxious or depressed about gambling</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>Borrowing money to gamble</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>Unable to stop or control gambling</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <ExclamationTriangleIcon className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span>Gambling to escape problems or emotions</span>
                  </li>
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Self-Exclusion Modal */}
      {showSelfExclusionModal && <SelfExclusionModal />}
    </div>
  );
};

export default ResponsibleGaming;

