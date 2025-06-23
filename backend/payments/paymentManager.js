const CryptocurrencyProcessor = require('./processors/cryptoProcessor');
const FiatPaymentProcessor = require('./processors/fiatProcessor');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const WalletAddress = require('../models/WalletAddress');
const { SecurityMonitor } = require('../utils/securityMonitor');

class PaymentManager {
  constructor() {
    this.cryptoProcessor = new CryptocurrencyProcessor({
      masterSeed: process.env.CRYPTO_MASTER_SEED || 'default-seed-change-in-production',
      encryptionKey: process.env.CRYPTO_ENCRYPTION_KEY || 'default-key-change-in-production',
      serviceFeeRates: {
        BTC: 0.001,
        ETH: 0.001,
        USDT: 0.001,
        LTC: 0.001,
        BCH: 0.001,
        DOGE: 0.001
      }
    });

    this.fiatProcessor = new FiatPaymentProcessor({
      encryptionKey: process.env.FIAT_ENCRYPTION_KEY || 'default-key-change-in-production',
      stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
      },
      paypal: {
        clientId: process.env.PAYPAL_CLIENT_ID,
        clientSecret: process.env.PAYPAL_CLIENT_SECRET,
        sandbox: process.env.NODE_ENV !== 'production'
      },
      skrill: {
        merchantId: process.env.SKRILL_MERCHANT_ID,
        secretWord: process.env.SKRILL_SECRET_WORD
      }
    });

    this.supportedCurrencies = [
      ...this.cryptoProcessor.getSupportedCurrencies(),
      ...this.fiatProcessor.getSupportedCurrencies()
    ];
  }

  /**
   * Generate deposit address or payment method
   * @param {string} userId - User ID
   * @param {string} currency - Currency
   * @param {string} method - Payment method (for fiat)
   * @returns {Object} Deposit information
   */
  async generateDeposit(userId, currency, method = null) {
    try {
      // Validate user
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.status !== 'active') {
        throw new Error('Account is not active');
      }

      // Check if currency is cryptocurrency
      if (this.cryptoProcessor.getSupportedCurrencies().includes(currency)) {
        return await this.generateCryptoDeposit(userId, currency);
      } 
      // Check if currency is fiat
      else if (this.fiatProcessor.getSupportedCurrencies().includes(currency)) {
        return await this.generateFiatDeposit(userId, currency, method);
      } 
      else {
        throw new Error(`Currency ${currency} not supported`);
      }

    } catch (error) {
      console.error('Error generating deposit:', error);
      throw error;
    }
  }

  /**
   * Generate cryptocurrency deposit address
   * @param {string} userId - User ID
   * @param {string} currency - Cryptocurrency
   * @returns {Object} Deposit address info
   */
  async generateCryptoDeposit(userId, currency) {
    try {
      // Check if user already has an address for this currency
      const existingAddress = await WalletAddress.findOne({
        userId,
        currency,
        status: 'active'
      });

      if (existingAddress) {
        return {
          type: 'cryptocurrency',
          currency,
          address: existingAddress.address,
          network: existingAddress.network,
          qrCode: this.cryptoProcessor.generateQRCode(existingAddress.address, currency),
          confirmationsRequired: this.cryptoProcessor.confirmationsRequired[currency],
          existing: true
        };
      }

      // Generate new address
      const addressInfo = await this.cryptoProcessor.generateDepositAddress(userId, currency);

      // Log address generation
      await SecurityMonitor.logEvent({
        userId,
        eventType: 'deposit_address_generated',
        severity: 'low',
        description: `Generated ${currency} deposit address`,
        metadata: {
          additionalData: {
            currency,
            address: addressInfo.address,
            network: addressInfo.network
          }
        }
      });

      return {
        type: 'cryptocurrency',
        ...addressInfo,
        existing: false
      };

    } catch (error) {
      console.error('Error generating crypto deposit:', error);
      throw error;
    }
  }

  /**
   * Generate fiat deposit method
   * @param {string} userId - User ID
   * @param {string} currency - Fiat currency
   * @param {string} method - Payment method
   * @returns {Object} Deposit method info
   */
  async generateFiatDeposit(userId, currency, method) {
    try {
      if (!method) {
        // Return available payment methods
        return {
          type: 'fiat',
          currency,
          availableMethods: this.fiatProcessor.getSupportedMethods(),
          limits: {
            minimum: this.fiatProcessor.getMinimumDeposit(currency),
            maximum: this.fiatProcessor.getMaximumDeposit(currency),
            daily: this.fiatProcessor.getDailyDepositLimit(currency)
          }
        };
      }

      // Return specific payment method info
      return {
        type: 'fiat',
        currency,
        method,
        limits: {
          minimum: this.fiatProcessor.getMinimumDeposit(currency),
          maximum: this.fiatProcessor.getMaximumDeposit(currency),
          daily: this.fiatProcessor.getDailyDepositLimit(currency)
        },
        fees: this.getFiatDepositFees(currency, method)
      };

    } catch (error) {
      console.error('Error generating fiat deposit:', error);
      throw error;
    }
  }

  /**
   * Process deposit
   * @param {Object} depositData - Deposit data
   * @returns {Object} Processing result
   */
  async processDeposit(depositData) {
    try {
      const { currency } = depositData;

      // Route to appropriate processor
      if (this.cryptoProcessor.getSupportedCurrencies().includes(currency)) {
        return await this.cryptoProcessor.processDeposit(depositData);
      } else if (this.fiatProcessor.getSupportedCurrencies().includes(currency)) {
        return await this.fiatProcessor.processDeposit(depositData);
      } else {
        throw new Error(`Currency ${currency} not supported`);
      }

    } catch (error) {
      console.error('Error processing deposit:', error);
      throw error;
    }
  }

  /**
   * Process withdrawal
   * @param {Object} withdrawalData - Withdrawal data
   * @returns {Object} Processing result
   */
  async processWithdrawal(withdrawalData) {
    try {
      const { currency, userId, amount } = withdrawalData;

      // Check user balance
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const balance = user.wallet.balance[currency] || 0;
      if (balance < amount) {
        throw new Error('Insufficient balance');
      }

      // Log withdrawal attempt
      await SecurityMonitor.logEvent({
        userId,
        eventType: 'withdrawal_request',
        severity: 'medium',
        description: `Withdrawal request: ${amount} ${currency}`,
        metadata: {
          additionalData: {
            amount,
            currency,
            balance
          }
        }
      });

      // Route to appropriate processor
      if (this.cryptoProcessor.getSupportedCurrencies().includes(currency)) {
        return await this.cryptoProcessor.processWithdrawal(
          userId,
          withdrawalData.toAddress,
          amount,
          currency
        );
      } else if (this.fiatProcessor.getSupportedCurrencies().includes(currency)) {
        return await this.fiatProcessor.processWithdrawal(withdrawalData);
      } else {
        throw new Error(`Currency ${currency} not supported`);
      }

    } catch (error) {
      console.error('Error processing withdrawal:', error);
      throw error;
    }
  }

  /**
   * Get user wallet information
   * @param {string} userId - User ID
   * @returns {Object} Wallet information
   */
  async getUserWallet(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Get wallet addresses
      const addresses = await WalletAddress.find({
        userId,
        status: 'active'
      }).select('-privateKey');

      // Get recent transactions
      const recentTransactions = await Transaction.find({
        userId
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('type amount currency status createdAt metadata');

      // Calculate total portfolio value (simplified)
      const portfolioValue = await this.calculatePortfolioValue(user.wallet.balance);

      return {
        balances: user.wallet.balance,
        addresses: addresses.reduce((acc, addr) => {
          acc[addr.currency] = {
            address: addr.address,
            network: addr.network,
            qrCode: this.cryptoProcessor.generateQRCode(addr.address, addr.currency)
          };
          return acc;
        }, {}),
        recentTransactions,
        portfolioValue,
        supportedCurrencies: this.supportedCurrencies
      };

    } catch (error) {
      console.error('Error getting user wallet:', error);
      throw error;
    }
  }

  /**
   * Get transaction history
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options
   * @returns {Object} Transaction history
   */
  async getTransactionHistory(userId, filters = {}) {
    try {
      const {
        type,
        currency,
        status,
        startDate,
        endDate,
        page = 1,
        limit = 20
      } = filters;

      const query = { userId };

      if (type) query.type = type;
      if (currency) query.currency = currency;
      if (status) query.status = status;
      
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [transactions, total] = await Promise.all([
        Transaction.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Transaction.countDocuments(query)
      ]);

      return {
        transactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      };

    } catch (error) {
      console.error('Error getting transaction history:', error);
      throw error;
    }
  }

  /**
   * Get payment statistics
   * @param {string} userId - User ID (optional)
   * @param {string} period - Time period
   * @returns {Object} Payment statistics
   */
  async getPaymentStats(userId = null, period = '30d') {
    try {
      let startDate = new Date();
      
      switch (period) {
        case '24h':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        default:
          startDate.setDate(startDate.getDate() - 30);
      }

      const matchStage = {
        createdAt: { $gte: startDate },
        status: { $in: ['completed', 'confirmed'] }
      };

      if (userId) {
        matchStage.userId = userId;
      }

      const stats = await Transaction.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: {
              type: '$type',
              currency: '$currency'
            },
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            avgAmount: { $avg: '$amount' }
          }
        },
        {
          $group: {
            _id: '$_id.type',
            currencies: {
              $push: {
                currency: '$_id.currency',
                count: '$count',
                totalAmount: '$totalAmount',
                avgAmount: '$avgAmount'
              }
            },
            totalCount: { $sum: '$count' },
            totalAmount: { $sum: '$totalAmount' }
          }
        }
      ]);

      return {
        period,
        stats: stats.reduce((acc, stat) => {
          acc[stat._id] = {
            totalCount: stat.totalCount,
            totalAmount: stat.totalAmount,
            currencies: stat.currencies
          };
          return acc;
        }, {}),
        startDate,
        endDate: new Date()
      };

    } catch (error) {
      console.error('Error getting payment stats:', error);
      throw error;
    }
  }

  /**
   * Handle webhook from payment providers
   * @param {string} provider - Payment provider
   * @param {Object} webhookData - Webhook data
   * @returns {Object} Processing result
   */
  async handleWebhook(provider, webhookData) {
    try {
      switch (provider) {
        case 'stripe':
          return await this.handleStripeWebhook(webhookData);
        case 'paypal':
          return await this.handlePayPalWebhook(webhookData);
        case 'skrill':
          return await this.handleSkrillWebhook(webhookData);
        case 'blockchain':
          return await this.handleBlockchainWebhook(webhookData);
        default:
          throw new Error(`Unknown webhook provider: ${provider}`);
      }

    } catch (error) {
      console.error('Error handling webhook:', error);
      throw error;
    }
  }

  /**
   * Handle Stripe webhook
   * @param {Object} webhookData - Stripe webhook data
   * @returns {Object} Processing result
   */
  async handleStripeWebhook(webhookData) {
    const { type, data } = webhookData;

    switch (type) {
      case 'payment_intent.succeeded':
        return await this.handleStripePaymentSuccess(data.object);
      case 'payment_intent.payment_failed':
        return await this.handleStripePaymentFailed(data.object);
      default:
        console.log(`Unhandled Stripe webhook type: ${type}`);
        return { status: 'ignored' };
    }
  }

  /**
   * Handle successful Stripe payment
   * @param {Object} paymentIntent - Stripe payment intent
   * @returns {Object} Processing result
   */
  async handleStripePaymentSuccess(paymentIntent) {
    try {
      // Find transaction by provider transaction ID
      const transaction = await Transaction.findOne({
        'metadata.providerTransactionId': paymentIntent.id,
        type: 'deposit'
      });

      if (!transaction) {
        console.error('Transaction not found for Stripe payment:', paymentIntent.id);
        return { status: 'error', message: 'Transaction not found' };
      }

      if (transaction.status === 'completed') {
        return { status: 'already_processed' };
      }

      // Update transaction status
      transaction.status = 'completed';
      await transaction.save();

      // Credit user balance
      await this.fiatProcessor.creditUserBalance(
        transaction.userId,
        transaction.amount,
        transaction.currency
      );

      // Log successful deposit
      await SecurityMonitor.logEvent({
        userId: transaction.userId,
        eventType: 'deposit_completed',
        severity: 'low',
        description: `Stripe deposit completed: ${transaction.amount} ${transaction.currency}`,
        metadata: {
          additionalData: {
            transactionId: transaction._id,
            providerTransactionId: paymentIntent.id,
            amount: transaction.amount,
            currency: transaction.currency
          }
        }
      });

      return { status: 'processed', transactionId: transaction._id };

    } catch (error) {
      console.error('Error handling Stripe payment success:', error);
      return { status: 'error', message: error.message };
    }
  }

  /**
   * Calculate portfolio value in USD
   * @param {Object} balances - User balances
   * @returns {number} Portfolio value in USD
   */
  async calculatePortfolioValue(balances) {
    try {
      // This is a simplified implementation
      // In production, integrate with real-time price APIs like CoinGecko, CoinMarketCap
      
      const prices = {
        BTC: 45000,
        ETH: 3000,
        USDT: 1,
        LTC: 150,
        BCH: 400,
        DOGE: 0.08,
        USD: 1,
        EUR: 1.1,
        GBP: 1.3,
        CAD: 0.8,
        AUD: 0.7
      };

      let totalValue = 0;
      
      for (const [currency, balance] of Object.entries(balances)) {
        const price = prices[currency] || 0;
        totalValue += balance * price;
      }

      return totalValue;

    } catch (error) {
      console.error('Error calculating portfolio value:', error);
      return 0;
    }
  }

  /**
   * Get fiat deposit fees
   * @param {string} currency - Currency
   * @param {string} method - Payment method
   * @returns {Object} Fee information
   */
  getFiatDepositFees(currency, method) {
    const feeRates = {
      credit_card: 0.029, // 2.9%
      debit_card: 0.029,
      bank_transfer: 0.01, // 1%
      e_wallet: 0.015 // 1.5%
    };

    const rate = feeRates[method] || 0.025;
    const fixedFee = currency === 'USD' ? 0.30 : 0.25;

    return {
      percentage: rate * 100,
      fixed: fixedFee,
      description: `${(rate * 100).toFixed(1)}% + ${fixedFee} ${currency}`
    };
  }

  /**
   * Get supported currencies
   * @returns {Array} Supported currencies
   */
  getSupportedCurrencies() {
    return this.supportedCurrencies;
  }

  /**
   * Get currency information
   * @param {string} currency - Currency
   * @returns {Object} Currency information
   */
  getCurrencyInfo(currency) {
    if (this.cryptoProcessor.getSupportedCurrencies().includes(currency)) {
      return {
        type: 'cryptocurrency',
        ...this.cryptoProcessor.getCurrencyInfo(currency)
      };
    } else if (this.fiatProcessor.getSupportedCurrencies().includes(currency)) {
      return {
        type: 'fiat',
        currency,
        minDeposit: this.fiatProcessor.getMinimumDeposit(currency),
        maxDeposit: this.fiatProcessor.getMaximumDeposit(currency),
        minWithdrawal: this.fiatProcessor.getMinimumWithdrawal(currency),
        maxWithdrawal: this.fiatProcessor.getMaximumWithdrawal(currency),
        dailyDepositLimit: this.fiatProcessor.getDailyDepositLimit(currency),
        dailyWithdrawalLimit: this.fiatProcessor.getDailyWithdrawalLimit(currency),
        supportedMethods: this.fiatProcessor.getSupportedMethods()
      };
    } else {
      throw new Error(`Currency ${currency} not supported`);
    }
  }
}

module.exports = PaymentManager;

