/*// next.config.js

module.exports = {
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'Content-Security-Policy',
              value: "default-src 'self'; script-src 'none'; object-src 'none';",
            },
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=63072000; includeSubDomains; preload',
            },
            // Lägg till fler säkerhetsheaders här
          ],
        },
      ];
    },
  };
  */