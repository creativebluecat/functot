(async () => {
    const fetch = (await import('node-fetch')).default;
    const chalk = (await import('chalk')).default;
    const fs = require('fs').promises;
    const { SocksProxyAgent } = require('socks-proxy-agent');

    const headersTemplate = {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'User-Agent': "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
    };

    // Helper function to create SocksProxyAgent with authentication
    function createProxyAgent(proxy) {
        const [ip, port, username, password] = proxy.split(':');
        const proxyUrl = `socks5://${username}:${password}@${ip}:${port}`;
        return new SocksProxyAgent(proxyUrl);
    }

    async function coday(url, method, payloadData = null, headers = headersTemplate, proxy = null) {
        try {
            const options = {
                method,
                headers,
                body: payloadData ? JSON.stringify(payloadData) : null
            };

            if (proxy) {
                const agent = createProxyAgent(proxy);  // Create a proxy agent with authentication
                options.agent = agent;
            }

            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Error:', error);
        }
    }

    async function loadSessions() {
        try {
            const data = await fs.readFile('accounts.json', 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error("Error loading Accounts:", error);
            return [];
        }
    }

    async function loadProxies() {
        try {
            const url = await fs.readFile('proxy.txt', 'utf8');
            const response = await fetch(url);
            const proxyData = await response.text();
            return proxyData.split('\n').map(line => line.trim()).filter(line => line);  // Return only non-empty lines
        } catch (error) {
            console.error("Error loading proxies:", error);
            return [];
        }
    }

    async function loginAndCheckIn(email, password, proxy) {
        console.log(`\nAttempting login for email: ${email} using proxy: ${proxy}`);
        const signInPayload = { email, password };
        const signIn = await coday("https://node.securitylabs.xyz/api/v1/auth/signin-user", 'POST', signInPayload, null, proxy);

        if (signIn && signIn.accessToken) {
            const headers = { ...headersTemplate, 'Authorization': `Bearer ${signIn.accessToken}` };
            console.log(chalk.green('Login succeeded! Fetching user details...'));

            const user = await coday("https://node.securitylabs.xyz/api/v1/users", 'GET', null, headers, proxy);
            const { id, dipTokenBalance } = user || {};
            if (id) {
                console.log(`User id: ${id} | Current points: ${dipTokenBalance}`);

                console.log("Attempting daily check-in...");
                const checkin = await coday(`https://node.securitylabs.xyz/api/v1/users/earn/${id}`, 'GET', null, headers, proxy);
                if (checkin && checkin.tokensToAward) {
                    console.log(chalk.green(`Check-in successful! Awarded points: ${checkin.tokensToAward}`));
                } else {
                    console.log(chalk.yellow('Check-in not available yet.'));
                }
            }
        } else {
            console.error(chalk.red(`Login failed for email: ${email}`));
        }
    }

    async function main() {
        const sessions = await loadSessions();
        if (sessions.length === 0) {
            console.log("No Accounts found.");
            return;
        }

        const proxies = await loadProxies();
        if (proxies.length === 0) {
            console.log("No proxies found.");
            return;
        }

        if (sessions.length > proxies.length) {
            console.log("Warning: More accounts than proxies. Some accounts may not use a proxy.");
        }

        while (true) {
            console.log("\nStarting daily check-in process for all accounts...");

            for (let i = 0; i < sessions.length; i++) {
                const { email, password } = sessions[i];
                const proxy = proxies[i % proxies.length];  // Cycle through proxies if more accounts than proxies
                if (email && password) await loginAndCheckIn(email, password, proxy);
            }

            console.log("All accounts processed. Waiting 24 hours for the next check-in...");
            await new Promise(resolve => setTimeout(resolve, 24 * 60 * 60 * 1000));  // 24 hours cooldown
        }
    }

    main();
})();
