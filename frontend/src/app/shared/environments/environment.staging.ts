export const environment = {
    production: false,
    apiUrl: '/api', // Relative URL for staging (served by same domain)
    apiTimeout: 20000, // 20 seconds timeout for staging
    enableLogging: true,
    enableDebugMode: true,
    cacheEnabled: true,
    features: {
        analytics: true,
        errorReporting: true,
        betaFeatures: true,
        devTools: true
    },
    appVersion: 'staging'
};