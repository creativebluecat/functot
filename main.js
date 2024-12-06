(async () => {
    const fetch = (await import('node-fetch')).default;
    const chalk = (await import('chalk')).default;
    const fs = require('fs').promises;

    const headersTemplate = {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'User-Agent': "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
    };

    async function coday(url, method, payloadData = null, headers = headersTemplate) {
        try {
            const options = {
                method,
                headers,
                body: payloadData ? JSON.stringify(payloadData) : null
            };
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

    async function loginAndCheckIn(email, password) {
        console.log(`\nAttempting login for email: ${email}`);
        const signInPayload = { email, password };
        const signIn = await coday("https://node.securitylabs.xyz/api/v1/auth/signin-user", 'POST', signInPayload);

        if (signIn && signIn.accessToken) {
            const headers = { ...headersTemplate, 'Authorization': `Bearer ${signIn.accessToken}` };
            console.log(chalk.green('Login succeeded! Fetching user details...'));

            const user = await coday("https://node.securitylabs.xyz/api/v1/users", 'GET', null, headers);
            const { id, dipTokenBalance } = user || {};
            if (id) {
                console.log(`User id: ${id} | Current points: ${dipTokenBalance}`);

                console.log("Attempting daily check-in...");
                const checkin = await coday(`https://node.securitylabs.xyz/api/v1/users/earn/${id}`, 'GET', null, headers);
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

        while (true) {
            console.log("\nStarting daily check-in process for all accounts...");

            for (const session of sessions) {
                const { email, password } = session;
                if (email && password) await loginAndCheckIn(email, password);
            }

            console.log("All accounts processed. Waiting 24 hours for the next check-in...");
            await new Promise(resolve => setTimeout(resolve, 24 * 60 * 60 * 1000));  // 24 hours cooldown
        }
    }

    main();
})();
