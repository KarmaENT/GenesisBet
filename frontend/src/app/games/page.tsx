
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  PlayIcon,
  StarIcon,
  FireIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

const GamesPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [favorites, setFavorites] = useState(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const categories = [
    { id: 'all', name: 'All Games', icon: '🎮' },
    { id: 'originals', name: 'Originals', icon: '⭐' },
    { id: 'slots', name: 'Slots', icon: '🎰' },
    { id: 'live', name: 'Live Casino', icon: '🃏' },
    { id: 'table', name: 'Table Games', icon: '🎲' },
    { id: 'sports', name: 'Sports', icon: '⚽' },
  ];

  const providers = [
    { id: 'all', name: 'All Providers' },
    { id: 'genesisbet', name: 'GenesisBet Originals' },
    { id: 'pragmatic', name: 'Pragmatic Play' },
    { id: 'evolution', name: 'Evolution Gaming' },
    { id: 'netent', name: 'NetEnt' },
    { id: 'hacksaw', name: 'Hacksaw Gaming' },
  ];

  const games = [
    {
      id: 1,
      name: 'Crash',
      provider: 'genesisbet',
      category: 'originals',
      image: '/games/crash.jpg',
      rtp: '99%',
      volatility: 'High',
      minBet: 0.01,
      maxBet: 1000,
      isHot: true,
      isNew: false,
      description: 'Watch the multiplier rise and cash out before it crashes',
      features: ['Provably Fair', 'Auto Cashout', 'Live Multiplayer']
    },
    {
      id: 2,
      name: 'Dice',
      provider: 'genesisbet',
      category: 'originals',
      image: '/games/dice.jpg',
      rtp: '99%',
      volatility: 'Medium',
      minBet: 0.01,
      maxBet: 1000,
      isHot: false,
      isNew: false,
      description: 'Classic dice game with customizable win chances',
      features: ['Provably Fair', 'Custom Odds', 'Auto Bet']
    },
    {
      id: 3,
      name: 'Plinko',
      provider: 'genesisbet',
      category: 'originals',
      image: '/games/plinko.jpg',
      rtp: '99%',
      volatility: 'Medium',
      minBet: 0.01,
      maxBet: 100,
      isHot: true,
      isNew: true,
      description: 'Drop the ball and watch it bounce to big wins',
      features: ['Provably Fair', 'Risk Levels', 'Visual Path']
    },
    {
      id: 4,
      name: 'Sweet Bonanza',
      provider: 'pragmatic',
      category: 'slots',
      image: '/games/sweet-bonanza.jpg',
      rtp: '96.51%',
      volatility: 'High',
      minBet: 0.20,
      maxBet: 125,
      isHot: true,
      isNew: false,
      description: 'Tumbling reels with multipliers up to 21,100x',
      features: ['Free Spins', 'Multipliers', 'Tumble Feature']
    },
    {
      id: 5,
      name: 'Lightning Roulette',
      provider: 'evolution',
      category: 'live',
      image: '/games/lightning-roulette.jpg',
      rtp: '97.30%',
      volatility: 'Medium',
      minBet: 0.20,
      maxBet: 5000,
      isHot: false,
      isNew: false,
      description: 'Live roulette with random multipliers up to 500x',
      features: ['Live Dealer', 'Lightning Numbers', 'HD Stream']
    },
    {
      id: 6,
      name: 'Blackjack',
      provider: 'evolution',
      category: 'table',
      image: '/games/blackjack.jpg',
      rtp: '99.28%',
      volatility: 'Low',
      minBet: 1,
      maxBet: 5000,
      isHot: false,
      isNew: false,
      description: 'Classic blackjack with perfect basic strategy',
      features: ['Live Dealer', 'Side Bets', 'Insurance']
    },
    {
      id: 7,
      name: 'Starburst',
      provider: 'netent',
      category: 'slots',
      image: '/games/starburst.jpg',
      rtp: '96.09%',
      volatility: 'Low',
      minBet: 0.10,
      maxBet: 100,
      isHot: false,
      isNew: false,
      description: 'The classic NetEnt slot with expanding wilds',
      features: ['Expanding Wilds', 'Re-spins', 'Both Ways Wins']
    },
    {
      id: 8,
      name: 'Wanted Dead or a Wild',
      provider: 'hacksaw',
      category: 'slots',
      image: '/games/wanted.jpg',
      rtp: '96.38%',
      volatility: 'High',
      minBet: 0.10,
      maxBet: 100,
      isHot: true,
      isNew: true,
      description: 'Wild West adventure with massive win potential',
      features: ['Free Spins', 'Sticky Wilds', 'Multipliers']
    },
  ];

  const filteredGames = games.filter(game => {
    const matchesSearch = game.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || game.category === selectedCategory;
    const matchesProvider = selectedProvider === 'all' || game.provider === selectedProvider;
    
    return matchesSearch && matchesCategory && matchesProvider;
  });

  const toggleFavorite = (gameId) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(gameId)) {
      newFavorites.delete(gameId);
    } else {
      newFavorites.add(gameId);
    }
    setFavorites(newFavorites);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white pt-16">
      {/* Header */}
      <section className="bg-gradient-to-r from-purple-900 via-gray-900 to-indigo-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-4 gradient-text">
              Game Library
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Discover thousands of games from top providers. Play slots, live casino, 
              originals, and more with instant deposits and provably fair gaming.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Filters */}
      <section className="py-8 bg-gray-800/50 sticky top-16 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search games..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
              />
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <motion.button
                  key={category.id}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 ${
                    selectedCategory === category.id
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  <span>{category.icon}</span>
                  <span>{category.name}</span>
                </motion.button>
              ))}
            </div>

            {/* Provider Filter */}
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-colors"
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Games Grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {filteredGames.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🎮</div>
              <h3 className="text-2xl font-bold mb-2">No games found</h3>
              <p className="text-gray-400">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredGames.map((game, index) => (
                <motion.div
                  key={game.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: isLoaded ? 1 : 0, y: isLoaded ? 0 : 30 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="game-card group"
                >
                  {/* Game Image */}
                  <div className="relative h-48 bg-gradient-to-br from-purple-600/20 to-indigo-600/20 overflow-hidden">
                    {/* Placeholder for game image */}
                    <div className="w-full h-full flex items-center justify-center text-6xl opacity-20 group-hover:opacity-30 transition-opacity">
                      {game.category === 'originals' && '⭐'}
                      {game.category === 'slots' && '🎰'}
                      {game.category === 'live' && '🃏'}
                      {game.category === 'table' && '🎲'}
                      {game.category === 'sports' && '⚽'}
                    </div>

                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex flex-col gap-2">
                      {game.isNew && (
                        <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                          <SparklesIcon className="w-3 h-3" />
                          NEW
                        </span>
                      )}
                      {game.isHot && (
                        <span className="bg-red-600 text-white px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1">
                          <FireIcon className="w-3 h-3" />
                          HOT
                        </span>
                      )}
                    </div>

                    {/* Favorite Button */}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => toggleFavorite(game.id)}
                      className="absolute top-3 right-3 p-2 bg-black/50 rounded-full hover:bg-black/70 transition-colors"
                    >
                      {favorites.has(game.id) ? (
                        <StarSolidIcon className="w-5 h-5 text-yellow-400" />
                      ) : (
                        <StarIcon className="w-5 h-5 text-gray-400" />
                      )}
                    </motion.button>

                    {/* Play Button Overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-full shadow-lg"
                      >
                        <PlayIcon className="w-8 h-8" />
                      </motion.button>
                    </div>

                    {/* Provider Badge */}
                    <div className="absolute bottom-3 left-3">
                      <span className="bg-purple-600 text-white px-2 py-1 rounded-full text-xs font-semibold">
                        {providers.find(p => p.id === game.provider)?.name || game.provider}
                      </span>
                    </div>
                  </div>

                  {/* Game Info */}
                  <div className="p-4">
                    <h3 className="text-lg font-bold mb-2 group-hover:text-purple-400 transition-colors">
                      {game.name}
                    </h3>
                    <p className="text-gray-400 text-sm mb-3 line-clamp-2">
                      {game.description}
                    </p>

                    {/* Game Stats */}
                    <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                      <div>
                        <span className="text-gray-400">RTP:</span>
                        <span className="text-green-400 font-semibold ml-1">{game.rtp}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Volatility:</span>
                        <span className="text-yellow-400 font-semibold ml-1">{game.volatility}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Min:</span>
                        <span className="text-white font-semibold ml-1">${game.minBet}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Max:</span>
                        <span className="text-white font-semibold ml-1">${game.maxBet}</span>
                      </div>
                    </div>

                    {/* Features */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {game.features.slice(0, 2).map((feature, idx) => (
                        <span
                          key={idx}
                          className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs"
                        >
                          {feature}
                        </span>
                      ))}
                      {game.features.length > 2 && (
                        <span className="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs">
                          +{game.features.length - 2}
                        </span>
                      )}
                    </div>

                    {/* Play Button */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full bg-purple-600 hover:bg-purple-700 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <PlayIcon className="w-4 h-4" />
                      Play Now
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Load More */}
      {filteredGames.length > 0 && (
        <section className="py-8">
          <div className="text-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gray-800 hover:bg-gray-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors border border-gray-600 hover:border-gray-500"
            >
              Load More Games
            </motion.button>
          </div>
        </section>
      )}
    </div>
  );
};

export default GamesPage;


