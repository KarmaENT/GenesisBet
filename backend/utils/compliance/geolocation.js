const axios = require('axios');
const { SecurityMonitor } = require('../securityMonitor');

class GeolocationCompliance {
  
  // Restricted jurisdictions
  static RESTRICTED_COUNTRIES = [
    'US', 'USA', 'United States',
    'UK', 'GB', 'United Kingdom', 'Great Britain',
    'FR', 'France',
    'IT', 'Italy',
    'ES', 'Spain',
    'AU', 'Australia',
    'NL', 'Netherlands',
    'BE', 'Belgium',
    'DK', 'Denmark',
    'SE', 'Sweden',
    'NO', 'Norway',
    'CH', 'Switzerland',
    'SG', 'Singapore',
    'HK', 'Hong Kong',
    'CN', 'China',
    'IN', 'India',
    'PK', 'Pakistan',
    'BD', 'Bangladesh',
    'AF', 'Afghanistan',
    'IR', 'Iran',
    'IQ', 'Iraq',
    'KP', 'North Korea',
    'SY', 'Syria',
    'YE', 'Yemen',
    'SO', 'Somalia',
    'SD', 'Sudan',
    'LY', 'Libya',
    'MM', 'Myanmar',
    'CU', 'Cuba'
  ];

  // High-risk jurisdictions requiring enhanced due diligence
  static HIGH_RISK_COUNTRIES = [
    'RU', 'Russia',
    'BY', 'Belarus',
    'VE', 'Venezuela',
    'ZW', 'Zimbabwe',
    'LB', 'Lebanon',
    'TH', 'Thailand',
    'PH', 'Philippines',
    'MY', 'Malaysia'
  ];

  // Get IP geolocation information
  static async getLocationFromIP(ipAddress) {
    try {
      // In production, use a reliable IP geolocation service
      // This is a mock implementation
      const response = await axios.get(`http://ip-api.com/json/${ipAddress}`, {
        timeout: 5000
      });

      if (response.data.status === 'success') {
        return {
          success: true,
          country: response.data.country,
          countryCode: response.data.countryCode,
          region: response.data.regionName,
          city: response.data.city,
          timezone: response.data.timezone,
          isp: response.data.isp,
          proxy: response.data.proxy || false,
          vpn: response.data.hosting || false
        };
      }

      return {
        success: false,
        error: 'Unable to determine location'
      };

    } catch (error) {
      console.error('Error getting IP location:', error);
      return {
        success: false,
        error: 'Geolocation service unavailable'
      };
    }
  }

  // Check if country is restricted
  static isRestrictedCountry(countryCode, countryName) {
    const code = countryCode?.toUpperCase();
    const name = countryName?.toLowerCase();
    
    return this.RESTRICTED_COUNTRIES.some(restricted => {
      return restricted.toUpperCase() === code || 
             restricted.toLowerCase() === name;
    });
  }

  // Check if country is high-risk
  static isHighRiskCountry(countryCode, countryName) {
    const code = countryCode?.toUpperCase();
    const name = countryName?.toLowerCase();
    
    return this.HIGH_RISK_COUNTRIES.some(highRisk => {
      return highRisk.toUpperCase() === code || 
             highRisk.toLowerCase() === name;
    });
  }

  // Validate user access based on location
  static async validateUserAccess(userId, ipAddress, userAgent) {
    try {
      const location = await this.getLocationFromIP(ipAddress);
      
      if (!location.success) {
        await SecurityMonitor.logEvent({
          userId,
          eventType: 'geolocation_check_failed',
          severity: 'medium',
          description: 'Failed to determine user location',
          metadata: {
            ipAddress,
            userAgent,
            error: location.error
          }
        });

        return {
          allowed: false,
          reason: 'Unable to verify location',
          requiresManualReview: true
        };
      }

      // Check for VPN/Proxy usage
      if (location.vpn || location.proxy) {
        await SecurityMonitor.logEvent({
          userId,
          eventType: 'vpn_proxy_detected',
          severity: 'high',
          description: 'VPN or proxy usage detected',
          metadata: {
            ipAddress,
            userAgent,
            location,
            vpn: location.vpn,
            proxy: location.proxy
          }
        });

        return {
          allowed: false,
          reason: 'VPN or proxy usage is not permitted',
          location,
          requiresManualReview: true
        };
      }

      // Check if country is restricted
      if (this.isRestrictedCountry(location.countryCode, location.country)) {
        await SecurityMonitor.logEvent({
          userId,
          eventType: 'restricted_jurisdiction_access',
          severity: 'high',
          description: 'Access attempt from restricted jurisdiction',
          metadata: {
            ipAddress,
            userAgent,
            location,
            countryCode: location.countryCode,
            country: location.country
          }
        });

        return {
          allowed: false,
          reason: `Access from ${location.country} is not permitted due to regulatory restrictions`,
          location,
          restricted: true
        };
      }

      // Check if country is high-risk
      if (this.isHighRiskCountry(location.countryCode, location.country)) {
        await SecurityMonitor.logEvent({
          userId,
          eventType: 'high_risk_jurisdiction_access',
          severity: 'medium',
          description: 'Access from high-risk jurisdiction',
          metadata: {
            ipAddress,
            userAgent,
            location,
            countryCode: location.countryCode,
            country: location.country
          }
        });

        return {
          allowed: true,
          location,
          highRisk: true,
          requiresEnhancedDueDiligence: true,
          warning: `Access from ${location.country} requires enhanced verification`
        };
      }

      // Log successful location verification
      await SecurityMonitor.logEvent({
        userId,
        eventType: 'geolocation_verified',
        severity: 'low',
        description: 'User location verified successfully',
        metadata: {
          ipAddress,
          userAgent,
          location,
          countryCode: location.countryCode,
          country: location.country
        }
      });

      return {
        allowed: true,
        location
      };

    } catch (error) {
      console.error('Error validating user access:', error);
      
      await SecurityMonitor.logEvent({
        userId,
        eventType: 'geolocation_validation_error',
        severity: 'high',
        description: 'Error during geolocation validation',
        metadata: {
          ipAddress,
          userAgent,
          error: error.message
        }
      });

      return {
        allowed: false,
        reason: 'Location verification failed',
        requiresManualReview: true
      };
    }
  }

  // Check for location consistency
  static async checkLocationConsistency(userId, currentIP, previousLocations) {
    try {
      const currentLocation = await this.getLocationFromIP(currentIP);
      
      if (!currentLocation.success || !previousLocations.length) {
        return { consistent: true, warning: false };
      }

      const lastLocation = previousLocations[previousLocations.length - 1];
      const timeDiff = Date.now() - new Date(lastLocation.timestamp).getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);

      // Check for rapid location changes (different countries within 2 hours)
      if (hoursDiff < 2 && 
          lastLocation.countryCode !== currentLocation.countryCode) {
        
        await SecurityMonitor.logEvent({
          userId,
          eventType: 'rapid_location_change',
          severity: 'high',
          description: 'Rapid location change detected',
          metadata: {
            currentLocation,
            lastLocation,
            timeDifferenceHours: hoursDiff,
            currentIP
          }
        });

        return {
          consistent: false,
          warning: true,
          reason: 'Rapid location change detected',
          currentLocation,
          lastLocation,
          timeDifference: hoursDiff
        };
      }

      // Check for multiple countries in short time period
      const recentLocations = previousLocations.filter(loc => {
        const locTime = new Date(loc.timestamp).getTime();
        return (Date.now() - locTime) < (24 * 60 * 60 * 1000); // 24 hours
      });

      const uniqueCountries = new Set(recentLocations.map(loc => loc.countryCode));
      uniqueCountries.add(currentLocation.countryCode);

      if (uniqueCountries.size > 3) {
        await SecurityMonitor.logEvent({
          userId,
          eventType: 'multiple_countries_detected',
          severity: 'medium',
          description: 'Multiple countries accessed within 24 hours',
          metadata: {
            currentLocation,
            recentLocations,
            uniqueCountries: Array.from(uniqueCountries),
            currentIP
          }
        });

        return {
          consistent: false,
          warning: true,
          reason: 'Multiple countries accessed within 24 hours',
          countries: Array.from(uniqueCountries)
        };
      }

      return { consistent: true, warning: false };

    } catch (error) {
      console.error('Error checking location consistency:', error);
      return { consistent: true, warning: false, error: error.message };
    }
  }

  // Get compliance requirements for country
  static getComplianceRequirements(countryCode) {
    const requirements = {
      // European Union countries
      'AT': { kycLevel: 2, taxReporting: true, gdprCompliance: true },
      'DE': { kycLevel: 3, taxReporting: true, gdprCompliance: true },
      'FI': { kycLevel: 2, taxReporting: true, gdprCompliance: true },
      'IE': { kycLevel: 2, taxReporting: true, gdprCompliance: true },
      'LU': { kycLevel: 2, taxReporting: true, gdprCompliance: true },
      'MT': { kycLevel: 3, taxReporting: true, gdprCompliance: true, mgaLicense: true },
      'PT': { kycLevel: 2, taxReporting: true, gdprCompliance: true },
      
      // Other jurisdictions
      'CA': { kycLevel: 2, taxReporting: true, provincialLicense: true },
      'JP': { kycLevel: 3, taxReporting: true, specialPermit: true },
      'KR': { kycLevel: 3, taxReporting: true, specialPermit: true },
      'BR': { kycLevel: 2, taxReporting: true },
      'MX': { kycLevel: 2, taxReporting: true },
      'AR': { kycLevel: 2, taxReporting: true },
      'CL': { kycLevel: 2, taxReporting: true },
      'CO': { kycLevel: 2, taxReporting: true },
      'PE': { kycLevel: 2, taxReporting: true },
      'ZA': { kycLevel: 2, taxReporting: true },
      'NZ': { kycLevel: 2, taxReporting: true },
      
      // Default requirements
      'DEFAULT': { kycLevel: 1, taxReporting: false, gdprCompliance: false }
    };

    return requirements[countryCode] || requirements['DEFAULT'];
  }

  // Generate compliance report
  static async generateComplianceReport(startDate, endDate) {
    try {
      const events = await SecurityMonitor.getEvents({
        eventType: {
          $in: [
            'geolocation_verified',
            'restricted_jurisdiction_access',
            'high_risk_jurisdiction_access',
            'vpn_proxy_detected',
            'rapid_location_change'
          ]
        },
        startDate,
        endDate
      });

      const report = {
        period: { startDate, endDate },
        summary: {
          totalAccessAttempts: 0,
          allowedAccess: 0,
          restrictedAccess: 0,
          highRiskAccess: 0,
          vpnProxyDetected: 0,
          rapidLocationChanges: 0
        },
        countryBreakdown: {},
        riskEvents: []
      };

      events.forEach(event => {
        report.summary.totalAccessAttempts++;

        switch (event.eventType) {
          case 'geolocation_verified':
            report.summary.allowedAccess++;
            break;
          case 'restricted_jurisdiction_access':
            report.summary.restrictedAccess++;
            break;
          case 'high_risk_jurisdiction_access':
            report.summary.highRiskAccess++;
            break;
          case 'vpn_proxy_detected':
            report.summary.vpnProxyDetected++;
            break;
          case 'rapid_location_change':
            report.summary.rapidLocationChanges++;
            break;
        }

        // Country breakdown
        const country = event.metadata?.location?.country || 
                       event.metadata?.countryCode || 'Unknown';
        
        if (!report.countryBreakdown[country]) {
          report.countryBreakdown[country] = {
            allowed: 0,
            restricted: 0,
            highRisk: 0,
            total: 0
          };
        }

        report.countryBreakdown[country].total++;

        if (event.eventType === 'geolocation_verified') {
          report.countryBreakdown[country].allowed++;
        } else if (event.eventType === 'restricted_jurisdiction_access') {
          report.countryBreakdown[country].restricted++;
        } else if (event.eventType === 'high_risk_jurisdiction_access') {
          report.countryBreakdown[country].highRisk++;
        }

        // High-risk events
        if (event.severity === 'high') {
          report.riskEvents.push({
            timestamp: event.createdAt,
            type: event.eventType,
            description: event.description,
            country: country,
            userId: event.userId
          });
        }
      });

      return report;

    } catch (error) {
      console.error('Error generating compliance report:', error);
      throw error;
    }
  }
}

module.exports = GeolocationCompliance;

