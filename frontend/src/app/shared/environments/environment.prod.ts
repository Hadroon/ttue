export const environment = {
    production: true,
    apiUrl: '/api', // Relative URL for production (served by same domain)
    apiTimeout: 30000, // 30 seconds timeout for production
    enableLogging: false,
    enableDebugMode: false,
    cacheEnabled: true,
    features: {
        analytics: true,
        errorReporting: true,
        betaFeatures: false,
        devTools: false
    },
    appVersion: '1.0.0' // This could be injected during build
};
