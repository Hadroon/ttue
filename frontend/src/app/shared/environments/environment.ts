export const environment = {
    production: false,
    apiUrl: '/api', // Use relative URL for proxy to work
    apiTimeout: 10000, // 10 seconds timeout for local
    enableLogging: true,
    enableDebugMode: true,
    cacheEnabled: false,
    features: {
        analytics: false,
        errorReporting: false,
        betaFeatures: true,
        devTools: true
    },
    appVersion: 'development'
};
