
'use client';

import { PlayIcon } from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

const HomePage = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentMultiplier, setCurrentMultiplier] = useState(1.00);

  useEffect(() => {
    setIsLoaded(true);
    
    // Simulate live crash game multiplier
    const interval = setInterval(() => {
      setCurrentMultiplier(prev => {
        const newMultiplier = prev + (Math.random() * 0.1);
        return newMultiplier > 10 ? 1.00 : newMultiplier;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: '⚡',
      title: 'Instant Deposits',
      description: 'Lightning-fast crypto deposits with immediate credit'
    },
    {
      icon: '🛡️',
      title: 'Provably Fair',
      description: 'Cryptographically verified fair gaming for all games'
    },
    {
      icon: '🏆',
      title: 'VIP Rewards',
      description: 'Exclusive bonuses and cashback for loyal players'
    },
    {
      icon: '👥',
      title: 'Live Community',
      description: 'Chat and compete with players worldwide'
    }
  ];

  const games = [
    {
      name: 'Crash',
      description: 'Watch the multiplier rise and cash out before it crashes',
      image: '/games/crash.jpg',
      category: 'Originals',
      multiplier: currentMultiplier
    },
    {
      name: 'Dice',
      description: 'Classic dice game with customizable win chances',
      image: '/games/dice.jpg',
      category: 'Originals'
    },
    {
      name: 'Plinko',
      description: 'Drop the ball and watch it bounce to big wins',
      image: '/games/plinko.jpg',
      category: 'Originals'
    },
    {
      name: 'Slots',
      description: 'Premium slot games from top providers',
      image: '/games/slots.jpg',
      category: 'Slots'
    },
    {
      name: 'Live Casino',
      description: 'Real dealers, real-time action',
      image: '/games/live.jpg',
      category: 'Live'
    },
    {
      name: 'Sports',
      description: 'Bet on your favorite sports and esports',
      image: '/games/sports.jpg',
      category: 'Sports'
    }
  ];

  const stats = [
    { label: 'Players Online', value: '12,847' },
    { label: 'Games Played Today', value: '2.4M' },
    { label: 'Total Winnings', value: '$45.2M' },
    { label: 'Biggest Win Today', value: '$127,500' }
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-900 via-gray-900 to-indigo-900">
        <div className="absolute inset-0 bg-black/20"></div>
        
        {/* Animated background elements */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-purple-400 rounded-full opacity-30"
              animate={{
                x: [0, Math.random() * 1000],
                y: [0, Math.random() * 800],
                scale: [0, 1, 0],
              }}
              transition={{
                duration: Math.random() * 10 + 10,
                repeat: Infinity,
                ease: "linear"
              }}
              style={{
                left: Math.random() * 100 + '%',
                top: Math.random() * 100 + '%',
              }}
            />
          ))}
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
              transition={{ duration: 0.8 }}
            >
              <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
                GenesisBet
              </h1>
              <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto">
                The world\'s most advanced crypto casino. Play provably fair games, 
                win big, and experience the future of online gambling.            </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12"
            >
              <Link href="/register">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-purple-500/25"
                >
                  Start Playing Now
                </motion.button>
              </Link>
              <Link href="/games">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="border border-purple-500 hover:bg-purple-500/10 px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200"
                >
                  Explore Games
                </motion.button>
              </Link>
            </motion.div>

            {/* Live Stats */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto"
            >
              {stats.map((stat, index) => (
                <div key={index} className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
                  <div className="text-2xl font-bold text-purple-400">{stat.value}</div>
                  <div className="text-sm text-gray-400">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Live Crash Game Preview */}
      <section className="py-16 bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Live Crash Game</h2>
            <p className="text-gray-400 text-lg">Watch the multiplier rise in real-time</p>
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="bg-gray-900 rounded-2xl p-8 border border-gray-700">
              <div className="text-center mb-6">
                <div className="text-6xl font-bold text-green-400 mb-2">
                  {currentMultiplier.toFixed(2)}x
                </div>
                <div className="text-gray-400">Current Multiplier</div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4 mb-6">
                <div className="h-32 bg-gradient-to-r from-green-500/20 to-red-500/20 rounded-lg flex items-end justify-end p-4">
                  <motion.div
                    className="w-4 h-4 bg-green-400 rounded-full"
                    animate={{
                      x: currentMultiplier * 10,
                      y: -currentMultiplier * 5
                    }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <input
                  type="number"
                  placeholder="Bet amount"
                  className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                  Bet
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Games Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Popular Games</h2>
            <p className="text-gray-400 text-lg">Choose from our collection of provably fair games</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {games.map((game, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -5 }}
                className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 hover:border-purple-500/50 transition-all duration-300 cursor-pointer group"
              >
                <div className="relative h-48 bg-gradient-to-br from-purple-600/20 to-indigo-600/20 flex items-center justify-center">
                  <div className="text-6xl opacity-20 group-hover:opacity-30 transition-opacity">
                    {game.name === 'Crash' && '📈'}
                    {game.name === 'Dice' && '🎲'}
                    {game.name === 'Plinko' && '🎯'}
                    {game.name === 'Slots' && '🎰'}
                    {game.name === 'Live Casino' && '🃏'}
                    {game.name === 'Sports' && '⚽'}
                  </div>
                  {game.multiplier && (
                    <div className="absolute top-4 right-4 bg-green-600 text-white px-3 py-1 rounded-full text-sm font-semibold">
                      {game.multiplier.toFixed(2)}x
                    </div>
                  )}
                  <div className="absolute top-4 left-4 bg-purple-600 text-white px-3 py-1 rounded-full text-sm">
                    {game.category}
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2 group-hover:text-purple-400 transition-colors">
                    {game.name}
                  </h3>
                  <p className="text-gray-400 mb-4">{game.description}</p>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-full bg-purple-600 hover:bg-purple-700 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <PlayIcon className="w-5 h-5" />
                    Play Now
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose GenesisBet?</h2>
            <p className="text-gray-400 text-lg">Experience the best in crypto gambling</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="text-center group"
              >
                <div className="bg-purple-600/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-purple-600/30 transition-colors">
                  <span className="text-3xl">{feature.icon}</span>
                </div>
                <h3 className="text-xl font-bold mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-purple-900 to-indigo-900">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Start Winning?
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Join thousands of players and experience the thrill of crypto gambling
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-white text-purple-900 hover:bg-gray-100 px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 shadow-lg"
                >
                  Create Account
                </motion.button>
              </Link>
              <Link href="/login">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="border border-white hover:bg-white/10 px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200"
                >
                  Sign In
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;


