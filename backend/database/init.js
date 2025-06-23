const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import models
const User = require('../models/User');
const Game = require('../models/Game');
const Bonus = require('../models/Bonus');

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/genesisbet');
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Create admin user
const createAdminUser = async () => {
  try {
    const existingAdmin = await User.findOne({ email: 'admin@genesisbet.com' });
    
    if (!existingAdmin) {
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash('Admin123!@#', salt);
      
      const adminUser = new User({
        email: 'admin@genesisbet.com',
        username: 'admin',
        password: hashedPassword,
        dateOfBirth: new Date('1990-01-01'),
        country: 'US',
        roles: ['admin'],
        status: 'active',
        profile: {
          tier: 'Diamond',
          totalWagered: 0,
          totalDeposited: 0,
          totalWithdrawn: 0
        },
        kyc: {
          status: 'verified',
          level: 3,
          verifiedAt: new Date()
        },
        wallet: {
          balance: {
            BTC: 0,
            ETH: 0,
            USDT: 0,
            USD: 0
          }
        }
      });
      
      await adminUser.save();
      console.log('Admin user created successfully');
    } else {
      console.log('Admin user already exists');
    }
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
};

// Seed games data
const seedGames = async () => {
  try {
    const existingGames = await Game.countDocuments();
    
    if (existingGames === 0) {
      const games = [
        // Provably Fair Games
        {
          name: 'Crash',
          slug: 'crash',
          category: 'provably_fair',
          provider: 'internal',
          description: 'Watch the multiplier rise and cash out before it crashes!',
          thumbnail: '/images/games/crash.png',
          rtp: 99,
          volatility: 'high',
          minBet: 0.01,
          maxBet: 1000,
          maxWin: 10000,
          features: ['multipliers', 'provably_fair'],
          currencies: ['BTC', 'ETH', 'USDT', 'USD'],
          status: 'active',
          tags: ['crash', 'multiplier', 'instant']
        },
        {
          name: 'Dice',
          slug: 'dice',
          category: 'provably_fair',
          provider: 'internal',
          description: 'Roll the dice and predict the outcome!',
          thumbnail: '/images/games/dice.png',
          rtp: 99,
          volatility: 'medium',
          minBet: 0.01,
          maxBet: 500,
          maxWin: 5000,
          features: ['provably_fair'],
          currencies: ['BTC', 'ETH', 'USDT', 'USD'],
          status: 'active',
          tags: ['dice', 'prediction', 'instant']
        },
        {
          name: 'Plinko',
          slug: 'plinko',
          category: 'provably_fair',
          provider: 'internal',
          description: 'Drop the ball and watch it bounce to a multiplier!',
          thumbnail: '/images/games/plinko.png',
          rtp: 99,
          volatility: 'medium',
          minBet: 0.01,
          maxBet: 100,
          maxWin: 1000,
          features: ['multipliers', 'provably_fair'],
          currencies: ['BTC', 'ETH', 'USDT', 'USD'],
          status: 'active',
          tags: ['plinko', 'multiplier', 'physics']
        },
        
        // Slots (Demo games - in production these would be from providers)
        {
          name: 'Sweet Bonanza',
          slug: 'sweet-bonanza',
          category: 'slots',
          provider: 'pragmatic_play',
          description: 'A sweet adventure with tumbling reels and multipliers!',
          thumbnail: '/images/games/sweet-bonanza.png',
          rtp: 96.51,
          volatility: 'high',
          minBet: 0.20,
          maxBet: 125,
          maxWin: 21100,
          features: ['free_spins', 'multipliers', 'tumbling_reels'],
          paylines: 0, // Cluster pays
          reels: 6,
          currencies: ['BTC', 'ETH', 'USDT', 'USD'],
          status: 'active',
          tags: ['sweet', 'candy', 'high_volatility']
        },
        {
          name: 'Gates of Olympus',
          slug: 'gates-of-olympus',
          category: 'slots',
          provider: 'pragmatic_play',
          description: 'Enter the realm of Zeus for divine wins!',
          thumbnail: '/images/games/gates-of-olympus.png',
          rtp: 96.5,
          volatility: 'high',
          minBet: 0.20,
          maxBet: 125,
          maxWin: 5000,
          features: ['free_spins', 'multipliers', 'tumbling_reels'],
          paylines: 0, // Cluster pays
          reels: 6,
          currencies: ['BTC', 'ETH', 'USDT', 'USD'],
          status: 'active',
          tags: ['mythology', 'zeus', 'high_volatility']
        },
        
        // Live Casino
        {
          name: 'Lightning Roulette',
          slug: 'lightning-roulette',
          category: 'live_casino',
          provider: 'evolution_gaming',
          description: 'Electrifying roulette with random multipliers!',
          thumbnail: '/images/games/lightning-roulette.png',
          rtp: 97.3,
          volatility: 'medium',
          minBet: 0.20,
          maxBet: 5000,
          maxWin: 500000,
          features: ['multipliers', 'live_dealer'],
          currencies: ['BTC', 'ETH', 'USDT', 'USD'],
          status: 'active',
          tags: ['roulette', 'live', 'multipliers']
        },
        {
          name: 'Blackjack Classic',
          slug: 'blackjack-classic',
          category: 'live_casino',
          provider: 'evolution_gaming',
          description: 'Classic blackjack with professional dealers!',
          thumbnail: '/images/games/blackjack-classic.png',
          rtp: 99.28,
          volatility: 'low',
          minBet: 1,
          maxBet: 5000,
          maxWin: 5000,
          features: ['live_dealer'],
          currencies: ['BTC', 'ETH', 'USDT', 'USD'],
          status: 'active',
          tags: ['blackjack', 'live', 'classic']
        }
      ];
      
      await Game.insertMany(games);
      console.log('Games seeded successfully');
    } else {
      console.log('Games already exist in database');
    }
  } catch (error) {
    console.error('Error seeding games:', error);
  }
};

// Seed bonuses data
const seedBonuses = async () => {
  try {
    const existingBonuses = await Bonus.countDocuments();
    
    if (existingBonuses === 0) {
      const bonuses = [
        {
          name: 'Welcome Bonus',
          type: 'welcome',
          description: 'Get 200% bonus on your first deposit up to 1 BTC!',
          terms: 'Minimum deposit 0.001 BTC. 35x wagering requirement. Valid for 30 days.',
          percentage: 200,
          maxAmount: 1,
          minDeposit: 0.001,
          wageringRequirement: 35,
          currencies: ['BTC'],
          eligibility: {
            newUsersOnly: true,
            minTier: 'Bronze'
          },
          validity: {
            startDate: new Date(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
            claimPeriod: 720 // 30 days
          },
          usage: {
            claimsPerUser: 1
          },
          games: {
            categories: ['slots', 'provably_fair']
          },
          status: 'active'
        },
        {
          name: 'Weekly Reload',
          type: 'reload',
          description: 'Get 50% bonus every Monday up to 0.5 BTC!',
          terms: 'Minimum deposit 0.01 BTC. 25x wagering requirement. Available every Monday.',
          percentage: 50,
          maxAmount: 0.5,
          minDeposit: 0.01,
          wageringRequirement: 25,
          currencies: ['BTC', 'ETH', 'USDT'],
          eligibility: {
            newUsersOnly: false,
            minTier: 'Bronze'
          },
          validity: {
            startDate: new Date(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            claimPeriod: 168 // 7 days
          },
          usage: {
            claimsPerUser: 0 // Unlimited
          },
          games: {
            categories: ['slots', 'provably_fair', 'live_casino']
          },
          status: 'active'
        },
        {
          name: 'VIP Cashback',
          type: 'cashback',
          description: 'Get 10% cashback on all losses for VIP members!',
          terms: 'Available for Gold tier and above. No wagering requirement. Credited weekly.',
          percentage: 10,
          wageringRequirement: 1, // No wagering
          currencies: ['BTC', 'ETH', 'USDT', 'USD'],
          eligibility: {
            newUsersOnly: false,
            minTier: 'Gold'
          },
          validity: {
            startDate: new Date(),
            endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            claimPeriod: 168 // 7 days
          },
          usage: {
            claimsPerUser: 0 // Unlimited
          },
          games: {
            categories: ['slots', 'provably_fair', 'live_casino', 'sportsbook']
          },
          status: 'active'
        }
      ];
      
      await Bonus.insertMany(bonuses);
      console.log('Bonuses seeded successfully');
    } else {
      console.log('Bonuses already exist in database');
    }
  } catch (error) {
    console.error('Error seeding bonuses:', error);
  }
};

// Create database indexes
const createIndexes = async () => {
  try {
    // User indexes
    await User.createIndexes();
    
    // Game indexes
    await Game.createIndexes();
    
    // Bonus indexes
    await Bonus.createIndexes();
    
    console.log('Database indexes created successfully');
  } catch (error) {
    console.error('Error creating indexes:', error);
  }
};

// Main initialization function
const initializeDatabase = async () => {
  try {
    console.log('Starting database initialization...');
    
    await connectDB();
    await createAdminUser();
    await seedGames();
    await seedBonuses();
    await createIndexes();
    
    console.log('Database initialization completed successfully!');
    
    // Display admin credentials
    console.log('\n=== ADMIN CREDENTIALS ===');
    console.log('Email: admin@genesisbet.com');
    console.log('Password: Admin123!@#');
    console.log('========================\n');
    
  } catch (error) {
    console.error('Database initialization failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run initialization if called directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = {
  initializeDatabase,
  connectDB,
  createAdminUser,
  seedGames,
  seedBonuses,
  createIndexes
};

