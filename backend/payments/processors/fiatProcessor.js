const axios = require('axios');
const crypto = require('crypto');

class FiatPaymentProcessor {
  constructor(config) {
    this.config = config;
    this.supportedCurrencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
    this.supportedMethods = ['credit_card', 'debit_card', 'bank_transfer', 'e_wallet'];
    this.providers = {
      stripe: this.initializeStripe(),
      paypal: this.initializePayPal(),
      skrill: this.initializeSkrill()
    };
  }

  /**
   * Initialize Stripe payment processor
   */
  initializeStripe() {
    if (!this.config.stripe?.secretKey) {
      return null;
    }

    return {
      name: 'Stripe',
      baseURL: 'https://api.stripe.com/v1',
      secretKey: this.config.stripe.secretKey,
      publishableKey: this.config.stripe.publishableKey,
      webhookSecret: this.config.stripe.webhookSecret
    };
  }

  /**
   * Initialize PayPal payment processor
   */
  initializePayPal() {
    if (!this.config.paypal?.clientId) {
      return null;
    }

    return {
      name: 'PayPal',
      baseURL: this.config.paypal.sandbox 
        ? 'https://api.sandbox.paypal.com'
        : 'https://api.paypal.com',
      clientId: this.config.paypal.clientId,
      clientSecret: this.config.paypal.clientSecret
    };
  }

  /**
   * Initialize Skrill payment processor
   */
  initializeSkrill() {
    if (!this.config.skrill?.merchantId) {
      return null;
    }

    return {
      name: 'Skrill',
      baseURL: 'https://www.skrill.com/app',
      merchantId: this.config.skrill.merchantId,
      secretWord: this.config.skrill.secretWord
    };
  }

  /**
   * Process fiat deposit
   * @param {Object} depositData - Deposit data
   * @returns {Object} Processing result
   */
  async processDeposit(depositData) {
    try {
      const {
        userId,
        amount,
        currency,
        paymentMethod,
        provider,
        paymentData
      } = depositData;

      // Validate deposit
      await this.validateDeposit(userId, amount, currency, paymentMethod);

      // Process based on provider
      let result;
      switch (provider) {
        case 'stripe':
          result = await this.processStripeDeposit(depositData);
          break;
        case 'paypal':
          result = await this.processPayPalDeposit(depositData);
          break;
        case 'skrill':
          result = await this.processSkrillDeposit(depositData);
          break;
        default:
          throw new Error(`Unsupported payment provider: ${provider}`);
      }

      // Create transaction record
      const Transaction = require('../../models/Transaction');
      const transaction = new Transaction({
        userId,
        type: 'deposit',
        amount,
        currency,
        status: result.status,
        metadata: {
          provider,
          paymentMethod,
          providerTransactionId: result.transactionId,
          providerData: result.providerData,
          fees: result.fees || 0
        }
      });

      await transaction.save();

      // Credit user balance if successful
      if (result.status === 'completed') {
        await this.creditUserBalance(userId, amount, currency);
        
        // Update transaction status
        transaction.status = 'completed';
        await transaction.save();
      }

      return {
        success: true,
        transactionId: transaction._id,
        providerTransactionId: result.transactionId,
        status: result.status,
        amount,
        currency,
        fees: result.fees || 0
      };

    } catch (error) {
      console.error('Error processing fiat deposit:', error);
      throw error;
    }
  }

  /**
   * Process Stripe deposit
   * @param {Object} depositData - Deposit data
   * @returns {Object} Processing result
   */
  async processStripeDeposit(depositData) {
    try {
      const { amount, currency, paymentData } = depositData;
      const stripe = this.providers.stripe;

      if (!stripe) {
        throw new Error('Stripe not configured');
      }

      // Create payment intent
      const paymentIntent = await this.makeStripeRequest('POST', '/payment_intents', {
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        payment_method: paymentData.paymentMethodId,
        confirmation_method: 'manual',
        confirm: true,
        metadata: {
          userId: depositData.userId,
          type: 'deposit'
        }
      });

      let status = 'pending';
      if (paymentIntent.status === 'succeeded') {
        status = 'completed';
      } else if (paymentIntent.status === 'requires_action') {
        status = 'requires_action';
      }

      return {
        status,
        transactionId: paymentIntent.id,
        providerData: {
          clientSecret: paymentIntent.client_secret,
          status: paymentIntent.status,
          nextAction: paymentIntent.next_action
        },
        fees: this.calculateStripeFees(amount, currency)
      };

    } catch (error) {
      console.error('Stripe deposit error:', error);
      throw new Error(`Stripe payment failed: ${error.message}`);
    }
  }

  /**
   * Process PayPal deposit
   * @param {Object} depositData - Deposit data
   * @returns {Object} Processing result
   */
  async processPayPalDeposit(depositData) {
    try {
      const { amount, currency, paymentData } = depositData;
      const paypal = this.providers.paypal;

      if (!paypal) {
        throw new Error('PayPal not configured');
      }

      // Get access token
      const accessToken = await this.getPayPalAccessToken();

      // Create order
      const order = await this.makePayPalRequest('POST', '/v2/checkout/orders', {
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: currency,
            value: amount.toFixed(2)
          },
          description: 'Deposit to gaming account'
        }],
        application_context: {
          return_url: `${process.env.FRONTEND_URL}/deposit/success`,
          cancel_url: `${process.env.FRONTEND_URL}/deposit/cancel`
        }
      }, accessToken);

      return {
        status: 'pending',
        transactionId: order.id,
        providerData: {
          approvalUrl: order.links.find(link => link.rel === 'approve')?.href,
          orderId: order.id
        },
        fees: this.calculatePayPalFees(amount, currency)
      };

    } catch (error) {
      console.error('PayPal deposit error:', error);
      throw new Error(`PayPal payment failed: ${error.message}`);
    }
  }

  /**
   * Process Skrill deposit
   * @param {Object} depositData - Deposit data
   * @returns {Object} Processing result
   */
  async processSkrillDeposit(depositData) {
    try {
      const { amount, currency, userId } = depositData;
      const skrill = this.providers.skrill;

      if (!skrill) {
        throw new Error('Skrill not configured');
      }

      // Generate transaction ID
      const transactionId = `skrill_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

      // Create Skrill payment form data
      const paymentData = {
        pay_to_email: skrill.merchantId,
        transaction_id: transactionId,
        return_url: `${process.env.FRONTEND_URL}/deposit/success`,
        cancel_url: `${process.env.FRONTEND_URL}/deposit/cancel`,
        status_url: `${process.env.BASE_URL}/api/payments/skrill/webhook`,
        language: 'EN',
        amount: amount.toFixed(2),
        currency,
        detail1_description: 'User ID',
        detail1_text: userId,
        merchant_fields: 'platform',
        platform: 'genesisbet'
      };

      return {
        status: 'pending',
        transactionId,
        providerData: {
          paymentUrl: `${skrill.baseURL}/pay.cgi`,
          formData: paymentData
        },
        fees: this.calculateSkrillFees(amount, currency)
      };

    } catch (error) {
      console.error('Skrill deposit error:', error);
      throw new Error(`Skrill payment failed: ${error.message}`);
    }
  }

  /**
   * Process fiat withdrawal
   * @param {Object} withdrawalData - Withdrawal data
   * @returns {Object} Processing result
   */
  async processWithdrawal(withdrawalData) {
    try {
      const {
        userId,
        amount,
        currency,
        withdrawalMethod,
        accountDetails
      } = withdrawalData;

      // Validate withdrawal
      await this.validateWithdrawal(userId, amount, currency, withdrawalMethod);

      // Calculate fees
      const fees = this.calculateWithdrawalFees(amount, currency, withdrawalMethod);
      const totalAmount = amount + fees;

      // Check user balance
      const User = require('../../models/User');
      const user = await User.findById(userId);
      const balance = user.wallet.balance[currency] || 0;

      if (balance < totalAmount) {
        throw new Error('Insufficient balance');
      }

      // Create withdrawal transaction
      const Transaction = require('../../models/Transaction');
      const transaction = new Transaction({
        userId,
        type: 'withdrawal',
        amount: totalAmount,
        currency,
        status: 'pending',
        metadata: {
          withdrawalAmount: amount,
          fees,
          withdrawalMethod,
          accountDetails: this.encryptAccountDetails(accountDetails)
        }
      });

      await transaction.save();

      // Deduct from user balance
      await this.debitUserBalance(userId, totalAmount, currency);

      // Process withdrawal (manual review for fiat)
      // In production, integrate with banking APIs or manual approval system

      return {
        success: true,
        transactionId: transaction._id,
        amount,
        fees,
        status: 'pending_review',
        estimatedProcessingTime: this.getEstimatedProcessingTime(withdrawalMethod)
      };

    } catch (error) {
      console.error('Error processing fiat withdrawal:', error);
      throw error;
    }
  }

  /**
   * Validate deposit request
   * @param {string} userId - User ID
   * @param {number} amount - Amount
   * @param {string} currency - Currency
   * @param {string} paymentMethod - Payment method
   */
  async validateDeposit(userId, amount, currency, paymentMethod) {
    // Check minimum deposit amount
    const minAmount = this.getMinimumDeposit(currency);
    if (amount < minAmount) {
      throw new Error(`Minimum deposit amount is ${minAmount} ${currency}`);
    }

    // Check maximum deposit amount
    const maxAmount = this.getMaximumDeposit(currency);
    if (amount > maxAmount) {
      throw new Error(`Maximum deposit amount is ${maxAmount} ${currency}`);
    }

    // Check if payment method is supported
    if (!this.supportedMethods.includes(paymentMethod)) {
      throw new Error(`Payment method ${paymentMethod} not supported`);
    }

    // Check daily deposit limits
    await this.checkDailyDepositLimits(userId, amount, currency);
  }

  /**
   * Validate withdrawal request
   * @param {string} userId - User ID
   * @param {number} amount - Amount
   * @param {string} currency - Currency
   * @param {string} withdrawalMethod - Withdrawal method
   */
  async validateWithdrawal(userId, amount, currency, withdrawalMethod) {
    // Check minimum withdrawal amount
    const minAmount = this.getMinimumWithdrawal(currency);
    if (amount < minAmount) {
      throw new Error(`Minimum withdrawal amount is ${minAmount} ${currency}`);
    }

    // Check maximum withdrawal amount
    const maxAmount = this.getMaximumWithdrawal(currency);
    if (amount > maxAmount) {
      throw new Error(`Maximum withdrawal amount is ${maxAmount} ${currency}`);
    }

    // Check user KYC status
    const User = require('../../models/User');
    const user = await User.findById(userId);
    
    if (user.kyc.status !== 'approved') {
      throw new Error('KYC verification required for fiat withdrawals');
    }

    // Check daily withdrawal limits
    await this.checkDailyWithdrawalLimits(userId, amount, currency);
  }

  /**
   * Make Stripe API request
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @returns {Object} API response
   */
  async makeStripeRequest(method, endpoint, data = {}) {
    const stripe = this.providers.stripe;
    
    const config = {
      method,
      url: `${stripe.baseURL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${stripe.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    if (method !== 'GET') {
      config.data = new URLSearchParams(data).toString();
    }

    const response = await axios(config);
    return response.data;
  }

  /**
   * Get PayPal access token
   * @returns {string} Access token
   */
  async getPayPalAccessToken() {
    const paypal = this.providers.paypal;
    
    const auth = Buffer.from(`${paypal.clientId}:${paypal.clientSecret}`).toString('base64');
    
    const response = await axios({
      method: 'POST',
      url: `${paypal.baseURL}/v1/oauth2/token`,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: 'grant_type=client_credentials'
    });

    return response.data.access_token;
  }

  /**
   * Make PayPal API request
   * @param {string} method - HTTP method
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request data
   * @param {string} accessToken - Access token
   * @returns {Object} API response
   */
  async makePayPalRequest(method, endpoint, data = {}, accessToken) {
    const paypal = this.providers.paypal;
    
    const config = {
      method,
      url: `${paypal.baseURL}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    if (method !== 'GET') {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  }

  /**
   * Calculate Stripe fees
   * @param {number} amount - Amount
   * @param {string} currency - Currency
   * @returns {number} Fee amount
   */
  calculateStripeFees(amount, currency) {
    // Stripe fees: 2.9% + $0.30 for US cards
    const percentage = 0.029;
    const fixed = currency === 'USD' ? 0.30 : 0.25;
    return (amount * percentage) + fixed;
  }

  /**
   * Calculate PayPal fees
   * @param {number} amount - Amount
   * @param {string} currency - Currency
   * @returns {number} Fee amount
   */
  calculatePayPalFees(amount, currency) {
    // PayPal fees: 2.9% + fixed fee
    const percentage = 0.029;
    const fixed = currency === 'USD' ? 0.30 : 0.35;
    return (amount * percentage) + fixed;
  }

  /**
   * Calculate Skrill fees
   * @param {number} amount - Amount
   * @param {string} currency - Currency
   * @returns {number} Fee amount
   */
  calculateSkrillFees(amount, currency) {
    // Skrill fees: 1.45% for most payment methods
    return amount * 0.0145;
  }

  /**
   * Calculate withdrawal fees
   * @param {number} amount - Amount
   * @param {string} currency - Currency
   * @param {string} method - Withdrawal method
   * @returns {number} Fee amount
   */
  calculateWithdrawalFees(amount, currency, method) {
    const feeRates = {
      bank_transfer: 0.01, // 1%
      e_wallet: 0.015, // 1.5%
      credit_card: 0.025 // 2.5%
    };

    const rate = feeRates[method] || 0.02;
    const minFee = currency === 'USD' ? 5 : 4;
    
    return Math.max(amount * rate, minFee);
  }

  /**
   * Check daily deposit limits
   * @param {string} userId - User ID
   * @param {number} amount - Amount
   * @param {string} currency - Currency
   */
  async checkDailyDepositLimits(userId, amount, currency) {
    const Transaction = require('../../models/Transaction');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dailyDeposits = await Transaction.aggregate([
      {
        $match: {
          userId: userId,
          type: 'deposit',
          currency,
          status: { $in: ['completed', 'pending'] },
          createdAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    const dailyTotal = dailyDeposits[0]?.total || 0;
    const dailyLimit = this.getDailyDepositLimit(currency);

    if (dailyTotal + amount > dailyLimit) {
      throw new Error(`Daily deposit limit of ${dailyLimit} ${currency} exceeded`);
    }
  }

  /**
   * Check daily withdrawal limits
   * @param {string} userId - User ID
   * @param {number} amount - Amount
   * @param {string} currency - Currency
   */
  async checkDailyWithdrawalLimits(userId, amount, currency) {
    const Transaction = require('../../models/Transaction');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dailyWithdrawals = await Transaction.aggregate([
      {
        $match: {
          userId: userId,
          type: 'withdrawal',
          currency,
          status: { $in: ['completed', 'pending', 'pending_review'] },
          createdAt: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    const dailyTotal = dailyWithdrawals[0]?.total || 0;
    const dailyLimit = this.getDailyWithdrawalLimit(currency);

    if (dailyTotal + amount > dailyLimit) {
      throw new Error(`Daily withdrawal limit of ${dailyLimit} ${currency} exceeded`);
    }
  }

  /**
   * Credit user balance
   * @param {string} userId - User ID
   * @param {number} amount - Amount
   * @param {string} currency - Currency
   */
  async creditUserBalance(userId, amount, currency) {
    const User = require('../../models/User');
    await User.findByIdAndUpdate(userId, {
      $inc: { [`wallet.balance.${currency}`]: amount }
    });
  }

  /**
   * Debit user balance
   * @param {string} userId - User ID
   * @param {number} amount - Amount
   * @param {string} currency - Currency
   */
  async debitUserBalance(userId, amount, currency) {
    const User = require('../../models/User');
    await User.findByIdAndUpdate(userId, {
      $inc: { [`wallet.balance.${currency}`]: -amount }
    });
  }

  /**
   * Encrypt account details
   * @param {Object} accountDetails - Account details
   * @returns {string} Encrypted details
   */
  encryptAccountDetails(accountDetails) {
    const cipher = crypto.createCipher('aes-256-cbc', this.config.encryptionKey);
    let encrypted = cipher.update(JSON.stringify(accountDetails), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Get minimum deposit amount
   * @param {string} currency - Currency
   * @returns {number} Minimum amount
   */
  getMinimumDeposit(currency) {
    const minimums = {
      USD: 10,
      EUR: 10,
      GBP: 8,
      CAD: 12,
      AUD: 15
    };

    return minimums[currency] || 10;
  }

  /**
   * Get maximum deposit amount
   * @param {string} currency - Currency
   * @returns {number} Maximum amount
   */
  getMaximumDeposit(currency) {
    const maximums = {
      USD: 10000,
      EUR: 9000,
      GBP: 8000,
      CAD: 12000,
      AUD: 15000
    };

    return maximums[currency] || 10000;
  }

  /**
   * Get minimum withdrawal amount
   * @param {string} currency - Currency
   * @returns {number} Minimum amount
   */
  getMinimumWithdrawal(currency) {
    const minimums = {
      USD: 20,
      EUR: 20,
      GBP: 15,
      CAD: 25,
      AUD: 30
    };

    return minimums[currency] || 20;
  }

  /**
   * Get maximum withdrawal amount
   * @param {string} currency - Currency
   * @returns {number} Maximum amount
   */
  getMaximumWithdrawal(currency) {
    const maximums = {
      USD: 5000,
      EUR: 4500,
      GBP: 4000,
      CAD: 6000,
      AUD: 7500
    };

    return maximums[currency] || 5000;
  }

  /**
   * Get daily deposit limit
   * @param {string} currency - Currency
   * @returns {number} Daily limit
   */
  getDailyDepositLimit(currency) {
    const limits = {
      USD: 5000,
      EUR: 4500,
      GBP: 4000,
      CAD: 6000,
      AUD: 7500
    };

    return limits[currency] || 5000;
  }

  /**
   * Get daily withdrawal limit
   * @param {string} currency - Currency
   * @returns {number} Daily limit
   */
  getDailyWithdrawalLimit(currency) {
    const limits = {
      USD: 2500,
      EUR: 2250,
      GBP: 2000,
      CAD: 3000,
      AUD: 3750
    };

    return limits[currency] || 2500;
  }

  /**
   * Get estimated processing time
   * @param {string} method - Withdrawal method
   * @returns {string} Estimated time
   */
  getEstimatedProcessingTime(method) {
    const times = {
      bank_transfer: '3-5 business days',
      e_wallet: '1-2 business days',
      credit_card: '5-7 business days'
    };

    return times[method] || '3-5 business days';
  }

  /**
   * Get supported currencies
   * @returns {Array} Supported currencies
   */
  getSupportedCurrencies() {
    return this.supportedCurrencies;
  }

  /**
   * Get supported payment methods
   * @returns {Array} Supported methods
   */
  getSupportedMethods() {
    return this.supportedMethods;
  }
}

module.exports = FiatPaymentProcessor;

