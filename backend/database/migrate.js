const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Migration tracking schema
const MigrationSchema = new mongoose.Schema({
  version: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  appliedAt: {
    type: Date,
    default: Date.now
  },
  rollbackScript: {
    type: String
  }
});

const Migration = mongoose.model('Migration', MigrationSchema);

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/genesisbet');
    console.log('MongoDB connected for migrations');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Migration definitions
const migrations = [
  {
    version: '1.0.0',
    name: 'initial_schema',
    description: 'Initial database schema setup',
    up: async () => {
      // Initial schema is created by models, no migration needed
      console.log('Initial schema migration - no action required');
    },
    down: async () => {
      // Drop all collections
      const collections = await mongoose.connection.db.listCollections().toArray();
      for (const collection of collections) {
        if (collection.name !== 'migrations') {
          await mongoose.connection.db.dropCollection(collection.name);
        }
      }
      console.log('Rolled back initial schema');
    }
  },
  
  {
    version: '1.1.0',
    name: 'add_user_metadata',
    description: 'Add metadata field to users for tracking additional information',
    up: async () => {
      const User = require('../models/User');
      
      // Add metadata field to all existing users
      await User.updateMany(
        { metadata: { $exists: false } },
        { 
          $set: { 
            metadata: {
              statusHistory: [],
              loginHistory: [],
              notes: ''
            }
          }
        }
      );
      
      console.log('Added metadata field to users');
    },
    down: async () => {
      const User = require('../models/User');
      
      // Remove metadata field
      await User.updateMany(
        {},
        { $unset: { metadata: 1 } }
      );
      
      console.log('Removed metadata field from users');
    }
  },
  
  {
    version: '1.2.0',
    name: 'add_game_tags_index',
    description: 'Add text index for game tags and description for search functionality',
    up: async () => {
      const Game = require('../models/Game');
      
      // Create text index for search
      await Game.collection.createIndex(
        { 
          name: 'text', 
          description: 'text', 
          tags: 'text' 
        },
        { 
          name: 'game_search_index',
          weights: {
            name: 10,
            tags: 5,
            description: 1
          }
        }
      );
      
      console.log('Added text search index for games');
    },
    down: async () => {
      const Game = require('../models/Game');
      
      // Drop text index
      await Game.collection.dropIndex('game_search_index');
      
      console.log('Removed text search index for games');
    }
  },
  
  {
    version: '1.3.0',
    name: 'add_transaction_ttl',
    description: 'Add TTL index for expired pending transactions',
    up: async () => {
      const Transaction = require('../models/Transaction');
      
      // Create TTL index for expired transactions
      await Transaction.collection.createIndex(
        { expiresAt: 1 },
        { 
          name: 'transaction_ttl_index',
          expireAfterSeconds: 0
        }
      );
      
      // Set expiration for existing pending transactions (24 hours)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await Transaction.updateMany(
        { 
          status: 'pending',
          expiresAt: { $exists: false },
          createdAt: { $lt: oneDayAgo }
        },
        { 
          $set: { 
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
          }
        }
      );
      
      console.log('Added TTL index for transactions');
    },
    down: async () => {
      const Transaction = require('../models/Transaction');
      
      // Drop TTL index
      await Transaction.collection.dropIndex('transaction_ttl_index');
      
      // Remove expiresAt field
      await Transaction.updateMany(
        {},
        { $unset: { expiresAt: 1 } }
      );
      
      console.log('Removed TTL index for transactions');
    }
  }
];

// Check if migration has been applied
const isMigrationApplied = async (version) => {
  const migration = await Migration.findOne({ version });
  return !!migration;
};

// Apply a single migration
const applyMigration = async (migration) => {
  try {
    console.log(`Applying migration ${migration.version}: ${migration.name}`);
    
    await migration.up();
    
    // Record migration
    await Migration.create({
      version: migration.version,
      name: migration.name,
      description: migration.description,
      rollbackScript: migration.down.toString()
    });
    
    console.log(`✓ Migration ${migration.version} applied successfully`);
  } catch (error) {
    console.error(`✗ Migration ${migration.version} failed:`, error);
    throw error;
  }
};

// Rollback a single migration
const rollbackMigration = async (version) => {
  try {
    const migrationRecord = await Migration.findOne({ version });
    if (!migrationRecord) {
      throw new Error(`Migration ${version} not found`);
    }
    
    const migration = migrations.find(m => m.version === version);
    if (!migration) {
      throw new Error(`Migration definition for ${version} not found`);
    }
    
    console.log(`Rolling back migration ${version}: ${migration.name}`);
    
    await migration.down();
    
    // Remove migration record
    await Migration.deleteOne({ version });
    
    console.log(`✓ Migration ${version} rolled back successfully`);
  } catch (error) {
    console.error(`✗ Rollback of migration ${version} failed:`, error);
    throw error;
  }
};

// Run all pending migrations
const runMigrations = async () => {
  try {
    await connectDB();
    
    console.log('Checking for pending migrations...');
    
    let appliedCount = 0;
    
    for (const migration of migrations) {
      const isApplied = await isMigrationApplied(migration.version);
      
      if (!isApplied) {
        await applyMigration(migration);
        appliedCount++;
      } else {
        console.log(`Migration ${migration.version} already applied`);
      }
    }
    
    if (appliedCount === 0) {
      console.log('No pending migrations found');
    } else {
      console.log(`Applied ${appliedCount} migration(s) successfully`);
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

// Rollback to specific version
const rollbackToVersion = async (targetVersion) => {
  try {
    await connectDB();
    
    console.log(`Rolling back to version ${targetVersion}...`);
    
    // Get all applied migrations after target version
    const appliedMigrations = await Migration.find({
      version: { $gt: targetVersion }
    }).sort({ version: -1 });
    
    for (const migrationRecord of appliedMigrations) {
      await rollbackMigration(migrationRecord.version);
    }
    
    console.log(`Rollback to version ${targetVersion} completed`);
    
  } catch (error) {
    console.error('Rollback failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

// Show migration status
const showStatus = async () => {
  try {
    await connectDB();
    
    console.log('\nMigration Status:');
    console.log('=================');
    
    for (const migration of migrations) {
      const isApplied = await isMigrationApplied(migration.version);
      const status = isApplied ? '✓ Applied' : '✗ Pending';
      console.log(`${migration.version} - ${migration.name}: ${status}`);
    }
    
    console.log('');
    
  } catch (error) {
    console.error('Failed to show status:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

// CLI interface
const main = async () => {
  const command = process.argv[2];
  const version = process.argv[3];
  
  switch (command) {
    case 'up':
      await runMigrations();
      break;
      
    case 'down':
      if (!version) {
        console.error('Please specify version to rollback to: npm run migrate down 1.0.0');
        process.exit(1);
      }
      await rollbackToVersion(version);
      break;
      
    case 'status':
      await showStatus();
      break;
      
    default:
      console.log('Usage:');
      console.log('  npm run migrate up          - Apply all pending migrations');
      console.log('  npm run migrate down <ver>  - Rollback to specific version');
      console.log('  npm run migrate status      - Show migration status');
      process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  runMigrations,
  rollbackToVersion,
  showStatus,
  migrations
};

