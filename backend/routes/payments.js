const express = require('express');
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/authEnhanced');
const PaymentManager = require('../payments/paymentManager');
const { SecurityMonitor } = require('../utils/securityMonitor');

const router = express.Router();
const paymentManager = new PaymentManager();

// @route   GET /api/payments/currencies
// @desc    Get supported currencies
// @access  Public
router.get('/currencies', (req, res) => {
  try {
    const currencies = paymentManager.getSupportedCurrencies();
    
    const currencyInfo = currencies.map(currency => {
      try {
        return paymentManager.getCurrencyInfo(currency);
      } catch (error) {
        return { currency, error: error.message };
      }
    });

    res.json({
      success: true,
      currencies: currencyInfo
    });

  } catch (error) {
    console.error('Error fetching currencies:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/payments/wallet
// @desc    Get user wallet information
// @access  Private
router.get('/wallet', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const wallet = await paymentManager.getUserWallet(userId);

    res.json({
      success: true,
      wallet
    });

  } catch (error) {
    console.error('Error fetching wallet:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/payments/deposit/generate
// @desc    Generate deposit address or payment method
// @access  Private
router.post('/deposit/generate', [
  auth,
  body('currency').isIn(['BTC', 'ETH', 'USDT', 'LTC', 'BCH', 'DOGE', 'USD', 'EUR', 'GBP', 'CAD', 'AUD']),
  body('method').optional().isIn(['credit_card', 'debit_card', 'bank_transfer', 'e_wallet'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { currency, method } = req.body;
    const userId = req.user.id;

    const depositInfo = await paymentManager.generateDeposit(userId, currency, method);

    res.json({
      success: true,
      deposit: depositInfo
    });

  } catch (error) {
    console.error('Error generating deposit:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/payments/deposit/process
// @desc    Process deposit
// @access  Private
router.post('/deposit/process', [
  auth,
  body('currency').isIn(['BTC', 'ETH', 'USDT', 'LTC', 'BCH', 'DOGE', 'USD', 'EUR', 'GBP', 'CAD', 'AUD']),
  body('amount').isFloat({ min: 0.01 }),
  body('provider').optional().isIn(['stripe', 'paypal', 'skrill']),
  body('paymentMethod').optional().isIn(['credit_card', 'debit_card', 'bank_transfer', 'e_wallet']),
  body('paymentData').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const depositData = {
      ...req.body,
      userId: req.user.id
    };

    const result = await paymentManager.processDeposit(depositData);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Error processing deposit:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/payments/withdraw
// @desc    Process withdrawal
// @access  Private
router.post('/withdraw', [
  auth,
  body('currency').isIn(['BTC', 'ETH', 'USDT', 'LTC', 'BCH', 'DOGE', 'USD', 'EUR', 'GBP', 'CAD', 'AUD']),
  body('amount').isFloat({ min: 0.01 }),
  body('toAddress').optional().isString(), // For crypto
  body('withdrawalMethod').optional().isIn(['bank_transfer', 'e_wallet', 'credit_card']), // For fiat
  body('accountDetails').optional().isObject() // For fiat
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const withdrawalData = {
      ...req.body,
      userId: req.user.id
    };

    const result = await paymentManager.processWithdrawal(withdrawalData);

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Error processing withdrawal:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// @route   GET /api/payments/transactions
// @desc    Get transaction history
// @access  Private
router.get('/transactions', auth, async (req, res) => {
  try {
    const {
      type,
      currency,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20
    } = req.query;

    const filters = {
      type,
      currency,
      status,
      startDate,
      endDate,
      page,
      limit
    };

    const history = await paymentManager.getTransactionHistory(req.user.id, filters);

    res.json({
      success: true,
      ...history
    });

  } catch (error) {
    console.error('Error fetching transaction history:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/payments/stats
// @desc    Get payment statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const userId = req.user.id;

    const stats = await paymentManager.getPaymentStats(userId, period);

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error fetching payment stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/payments/webhook/stripe
// @desc    Handle Stripe webhook
// @access  Public (webhook)
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // Verify webhook signature (simplified)
    // In production, use Stripe's webhook signature verification

    const event = JSON.parse(req.body);
    
    const result = await paymentManager.handleWebhook('stripe', event);

    res.json({ received: true, result });

  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});

// @route   POST /api/payments/webhook/paypal
// @desc    Handle PayPal webhook
// @access  Public (webhook)
router.post('/webhook/paypal', async (req, res) => {
  try {
    const result = await paymentManager.handleWebhook('paypal', req.body);
    res.json({ received: true, result });

  } catch (error) {
    console.error('PayPal webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});

// @route   POST /api/payments/webhook/skrill
// @desc    Handle Skrill webhook
// @access  Public (webhook)
router.post('/webhook/skrill', async (req, res) => {
  try {
    const result = await paymentManager.handleWebhook('skrill', req.body);
    res.json({ received: true, result });

  } catch (error) {
    console.error('Skrill webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});

// @route   POST /api/payments/webhook/blockchain
// @desc    Handle blockchain webhook (for crypto deposits)
// @access  Public (webhook)
router.post('/webhook/blockchain', async (req, res) => {
  try {
    const result = await paymentManager.handleWebhook('blockchain', req.body);
    res.json({ received: true, result });

  } catch (error) {
    console.error('Blockchain webhook error:', error);
    res.status(400).json({ error: error.message });
  }
});

// @route   GET /api/payments/transaction/:id
// @desc    Get specific transaction details
// @access  Private
router.get('/transaction/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const Transaction = require('../models/Transaction');
    const transaction = await Transaction.findOne({
      _id: id,
      userId
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      transaction
    });

  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/payments/verify-address
// @desc    Verify cryptocurrency address
// @access  Private
router.post('/verify-address', [
  auth,
  body('address').notEmpty(),
  body('currency').isIn(['BTC', 'ETH', 'USDT', 'LTC', 'BCH', 'DOGE'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { address, currency } = req.body;
    
    const isValid = paymentManager.cryptoProcessor.isValidAddress(address, currency);

    res.json({
      success: true,
      valid: isValid,
      address,
      currency
    });

  } catch (error) {
    console.error('Error verifying address:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/payments/fees/:currency
// @desc    Get fee information for currency
// @access  Public
router.get('/fees/:currency', (req, res) => {
  try {
    const { currency } = req.params;
    const { method } = req.query;

    let fees;
    
    if (paymentManager.cryptoProcessor.getSupportedCurrencies().includes(currency)) {
      fees = {
        type: 'cryptocurrency',
        currency,
        withdrawal: {
          network: paymentManager.cryptoProcessor.getNetworkFee(currency),
          service: paymentManager.cryptoProcessor.config.serviceFeeRates[currency] || 0.001
        },
        deposit: {
          network: 0, // No fees for deposits
          service: 0
        }
      };
    } else if (paymentManager.fiatProcessor.getSupportedCurrencies().includes(currency)) {
      fees = {
        type: 'fiat',
        currency,
        deposit: method ? paymentManager.getFiatDepositFees(currency, method) : null,
        withdrawal: {
          bank_transfer: paymentManager.fiatProcessor.calculateWithdrawalFees(100, currency, 'bank_transfer'),
          e_wallet: paymentManager.fiatProcessor.calculateWithdrawalFees(100, currency, 'e_wallet'),
          credit_card: paymentManager.fiatProcessor.calculateWithdrawalFees(100, currency, 'credit_card')
        }
      };
    } else {
      return res.status(404).json({
        success: false,
        message: 'Currency not supported'
      });
    }

    res.json({
      success: true,
      fees
    });

  } catch (error) {
    console.error('Error fetching fees:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/payments/cancel/:id
// @desc    Cancel pending transaction
// @access  Private
router.post('/cancel/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const Transaction = require('../models/Transaction');
    const transaction = await Transaction.findOne({
      _id: id,
      userId,
      status: 'pending'
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found or cannot be cancelled'
      });
    }

    // Update transaction status
    transaction.status = 'cancelled';
    await transaction.save();

    // Refund balance if it was a withdrawal
    if (transaction.type === 'withdrawal') {
      const User = require('../models/User');
      await User.findByIdAndUpdate(userId, {
        $inc: { [`wallet.balance.${transaction.currency}`]: transaction.amount }
      });
    }

    // Log cancellation
    await SecurityMonitor.logEvent({
      userId,
      eventType: 'transaction_cancelled',
      severity: 'low',
      description: `Transaction cancelled: ${transaction.type} ${transaction.amount} ${transaction.currency}`,
      metadata: {
        additionalData: {
          transactionId: id,
          type: transaction.type,
          amount: transaction.amount,
          currency: transaction.currency
        }
      }
    });

    res.json({
      success: true,
      message: 'Transaction cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/payments/limits
// @desc    Get user payment limits
// @access  Private
router.get('/limits', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const User = require('../models/User');
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get limits based on KYC status and VIP level
    const isKycApproved = user.kyc.status === 'approved';
    const vipLevel = user.vip.level;

    const limits = {};

    // Calculate limits for each supported currency
    for (const currency of paymentManager.getSupportedCurrencies()) {
      try {
        const currencyInfo = paymentManager.getCurrencyInfo(currency);
        
        let multiplier = 1;
        if (isKycApproved) multiplier *= 10; // 10x limits for KYC approved
        if (vipLevel > 0) multiplier *= (1 + vipLevel * 0.5); // VIP bonus

        if (currencyInfo.type === 'cryptocurrency') {
          limits[currency] = {
            type: 'cryptocurrency',
            deposit: {
              min: currencyInfo.minWithdrawal,
              max: currencyInfo.maxWithdrawal * multiplier,
              daily: currencyInfo.dailyLimit * multiplier
            },
            withdrawal: {
              min: currencyInfo.minWithdrawal,
              max: currencyInfo.maxWithdrawal * multiplier,
              daily: currencyInfo.dailyLimit * multiplier
            }
          };
        } else {
          limits[currency] = {
            type: 'fiat',
            deposit: {
              min: currencyInfo.minDeposit,
              max: currencyInfo.maxDeposit * multiplier,
              daily: currencyInfo.dailyDepositLimit * multiplier
            },
            withdrawal: {
              min: currencyInfo.minWithdrawal,
              max: currencyInfo.maxWithdrawal * multiplier,
              daily: currencyInfo.dailyWithdrawalLimit * multiplier
            }
          };
        }
      } catch (error) {
        console.error(`Error getting limits for ${currency}:`, error);
      }
    }

    res.json({
      success: true,
      limits,
      kycStatus: user.kyc.status,
      vipLevel: user.vip.level
    });

  } catch (error) {
    console.error('Error fetching payment limits:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

module.exports = router;

