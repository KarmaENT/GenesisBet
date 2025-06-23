'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  EnvelopeIcon, 
  ChatBubbleLeftRightIcon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
  GlobeAltIcon,
  HeartIcon
} from '@heroicons/react/24/outline';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerSections = [
    {
      title: 'Games',
      links: [
        { name: 'Crash', href: '/games/crash' },
        { name: 'Dice', href: '/games/dice' },
        { name: 'Plinko', href: '/games/plinko' },
        { name: 'Slots', href: '/games/slots' },
        { name: 'Live Casino', href: '/games/live' },
        { name: 'Sports Betting', href: '/sports' },
      ]
    },
    {
      title: 'Support',
      links: [
        { name: 'Help Center', href: '/help' },
        { name: 'Live Chat', href: '/chat' },
        { name: 'Contact Us', href: '/contact' },
        { name: 'Bug Reports', href: '/bugs' },
        { name: 'Feature Requests', href: '/features' },
        { name: 'Community', href: '/community' },
      ]
    },
    {
      title: 'Legal',
      links: [
        { name: 'Terms of Service', href: '/terms' },
        { name: 'Privacy Policy', href: '/privacy' },
        { name: 'Responsible Gaming', href: '/responsible-gaming' },
        { name: 'AML Policy', href: '/aml' },
        { name: 'KYC Policy', href: '/kyc' },
        { name: 'Fairness', href: '/fairness' },
      ]
    },
    {
      title: 'Company',
      links: [
        { name: 'About Us', href: '/about' },
        { name: 'Careers', href: '/careers' },
        { name: 'Press', href: '/press' },
        { name: 'Partnerships', href: '/partnerships' },
        { name: 'Affiliates', href: '/affiliates' },
        { name: 'Blog', href: '/blog' },
      ]
    }
  ];

  const socialLinks = [
    { name: 'Twitter', href: 'https://twitter.com/genesisbet', icon: '🐦' },
    { name: 'Discord', href: 'https://discord.gg/genesisbet', icon: '💬' },
    { name: 'Telegram', href: 'https://t.me/genesisbet', icon: '📱' },
    { name: 'Reddit', href: 'https://reddit.com/r/genesisbet', icon: '🔴' },
  ];

  const currencies = [
    { name: 'Bitcoin', symbol: 'BTC', icon: '₿' },
    { name: 'Ethereum', symbol: 'ETH', icon: 'Ξ' },
    { name: 'Tether', symbol: 'USDT', icon: '₮' },
    { name: 'Litecoin', symbol: 'LTC', icon: 'Ł' },
  ];

  const features = [
    {
      icon: ShieldCheckIcon,
      title: 'Provably Fair',
      description: 'All games are cryptographically verified'
    },
    {
      icon: CurrencyDollarIcon,
      title: 'Instant Payouts',
      description: 'Lightning-fast withdrawals'
    },
    {
      icon: GlobeAltIcon,
      title: '24/7 Support',
      description: 'Round-the-clock customer service'
    }
  ];

  return (
    <footer className="bg-gray-900 border-t border-gray-800">
      {/* Features Section */}
      <div className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="flex items-center space-x-4"
              >
                <div className="bg-purple-600/20 p-3 rounded-lg">
                  <feature.icon className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{feature.title}</h3>
                  <p className="text-gray-400 text-sm">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8">
          {/* Brand Section */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center space-x-2 mb-4">
              <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
                GenesisBet
              </div>
            </Link>
            <p className="text-gray-400 mb-6 max-w-sm">
              The world's most advanced crypto casino. Experience provably fair gaming, 
              instant deposits, and massive jackpots.
            </p>
            
            {/* Supported Currencies */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-300 mb-3">Supported Currencies</h4>
              <div className="flex flex-wrap gap-2">
                {currencies.map((currency) => (
                  <div
                    key={currency.symbol}
                    className="bg-gray-800 px-3 py-1 rounded-full text-sm flex items-center space-x-1"
                  >
                    <span>{currency.icon}</span>
                    <span className="text-gray-300">{currency.symbol}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Social Links */}
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-3">Follow Us</h4>
              <div className="flex space-x-3">
                {socialLinks.map((social) => (
                  <motion.a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="bg-gray-800 hover:bg-gray-700 p-2 rounded-lg transition-colors"
                  >
                    <span className="text-lg">{social.icon}</span>
                  </motion.a>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Links */}
          {footerSections.map((section, index) => (
            <div key={section.title} className="lg:col-span-1">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                {section.title}
              </h3>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-gray-400 hover:text-white transition-colors text-sm"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Section */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-6 text-sm text-gray-400">
              <p>© {currentYear} GenesisBet. All rights reserved.</p>
              <div className="flex items-center space-x-4">
                <span className="flex items-center space-x-1">
                  <span>🔒</span>
                  <span>SSL Secured</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span>🛡️</span>
                  <span>Licensed</span>
                </span>
                <span className="flex items-center space-x-1">
                  <span>✅</span>
                  <span>Provably Fair</span>
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-4 text-sm text-gray-400">
              <Link href="/help" className="hover:text-white transition-colors flex items-center space-x-1">
                <ChatBubbleLeftRightIcon className="w-4 h-4" />
                <span>Live Support</span>
              </Link>
              <Link href="/contact" className="hover:text-white transition-colors flex items-center space-x-1">
                <EnvelopeIcon className="w-4 h-4" />
                <span>Contact</span>
              </Link>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="mt-6 pt-6 border-t border-gray-800">
            <p className="text-xs text-gray-500 text-center max-w-4xl mx-auto">
              <strong>Disclaimer:</strong> Gambling can be addictive. Please play responsibly. 
              GenesisBet is committed to responsible gaming and provides tools to help you stay in control. 
              You must be 18+ to play. Some jurisdictions may restrict access to online gambling. 
              Check your local laws before playing.
            </p>
          </div>

          {/* Made with Love */}
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500 flex items-center justify-center space-x-1">
              <span>Made with</span>
              <HeartIcon className="w-3 h-3 text-red-500" />
              <span>for the crypto community</span>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

