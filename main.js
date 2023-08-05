// Require the necessary discord.js classes
const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');
const { token, dataFilePath, rssFeeds, UmaruQuotes } = require('./config.json');
let Parser = require('rss-parser');
let parser = new Parser();

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
let clientReady = false;

client.commands = new Collection();
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

// When the client is ready, run this code (only once)
// We use 'c' for the event parameter to keep it separate from the already defined 'client'
client.once(Events.ClientReady, c => {
    log(`Ready! Logged in as ${c.user.tag}`);
    clientReady = true;
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
});

// Log in to Discord with your client's token
client.login(token);

async function getJson(url) {
    return new Promise((resolve, reject) => {
        fs.readFile(url, 'utf8', function readFileCallback(err, data) {
            if (err) {
                reject(err);
            }
            else {
                let dataJson = null;

                try {
                    dataJson = JSON.parse(data);
                } catch (error) {
                    log('cannot turn into json URL: ' + url);
                    reject(error);
                }

                resolve(dataJson);
            }
        });
    });
}

async function saveJson(url, data) {
    return new Promise((resolve, reject) => {
        fs.writeFile(url, JSON.stringify(data).replace(/},{/g, '},\n{'), 'utf8', function (err) {
            if (err) {
                reject(err);
            }
            else {
                resolve(true);
            }
        });
    });
}

Date.prototype.toStringSystem = function () {
    return this.getUTCFullYear() + '-' +
        ((this.getUTCMonth() + 1) > 9 ? '' : '0') + (this.getUTCMonth() + 1) + '-' +
        (this.getUTCDate() > 9 ? '' : '0') + this.getUTCDate() + 'T' +
        (this.getUTCHours() > 9 ? '' : '0') + this.getUTCHours() + ':' +
        (this.getUTCMinutes() > 9 ? '' : '0') + this.getUTCMinutes() + ':' +
        (this.getUTCSeconds() > 9 ? '' : '0') + this.getUTCSeconds();
}

function log(text1) {
    console.log(new Date().toStringSystem(), text1);
}

// Actual bot logic stuff!
let postQueue = []; // {channelId:whatever, content:message}
let consecutiveErrors = 0;
let consecutiveErrorsMax = 3;

// Random quips
setInterval(async () => {
    if (clientReady) {
        if (Math.random() > 0.98) {
            let dataFile = await getJson(dataFilePath);

            Object.keys(dataFile.guildsToUpdate).forEach(guildId => {
                /* let channelId = dataFile.guildsToUpdate[guildId].channelId;
                let channel = client.channels.cache.get(channelId);
                channel.send(UmaruQuotes[Math.floor(Math.random() * UmaruQuotes.length)]); */

                postQueue.push({ guildId: guildId, channelId: dataFile.guildsToUpdate[guildId].channelId, content: UmaruQuotes[Math.floor(Math.random() * UmaruQuotes.length)] });
            });
        }
    }
}, 830000);

setInterval(async () => {
    let dataFile = await getJson(dataFilePath);
    let latestTimestampLast = dataFile.latestTimestamp;
    let latestTimestampFound = dataFile.latestTimestamp;

    if (clientReady) {
        let feedFailedCount = 0;
        for (let i = 0; i < rssFeeds.length; i++) {
            try {
                let rssFeed = rssFeeds[i];
                let feed = await parser.parseURL(rssFeed);

                feed.items.forEach(item => {
                    if (new Date(item.isoDate).getTime() > latestTimestampLast) {
                        latestTimestampFound = Math.max(latestTimestampFound, new Date(item.isoDate).getTime());

                        log("Sending new article: " + item.link);

                        Object.keys(dataFile.guildsToUpdate).forEach(guildId => {
                            postQueue.push({ guildId: guildId, channelId: dataFile.guildsToUpdate[guildId].channelId, content: item.link });
                        });
                    }
                });
            } catch (error) {
                feedFailedCount++;

                if (feedFailedCount == rssFeeds.length) {
                    log("All feeds (" + feedFailedCount + ") failed, restarting");
                    process.exit(1);
                }
            }

        }
    }

    dataFile.latestTimestamp = Math.max(latestTimestampFound, latestTimestampLast);
    await saveJson(dataFilePath, dataFile);
}, 150000);

setInterval(async () => {
    if (clientReady) {
        if (postQueue.length > 0) {
            let newPost = postQueue.pop();
            let channel = client.channels.cache.get(newPost.channelId);

            // if we can't fetch the channel from cache, means umaru was most likely removed from the server
            if (!channel) {
                dataFile = await getJson(dataFilePath);

                if (dataFile.guildsToUpdate[newPost.guildId]) {
                    delete dataFile.guildsToUpdate[newPost.guildId];
                    await saveJson(dataFilePath, dataFile);
                    log("Got kicked out of guild: " + newPost.guildId);
                }
            }
            else {
                channel.send(newPost.content)
                    .then(message => {
                        if (consecutiveErrors > 0) {
                            consecutiveErrors--;
                            log("Removed error token. Total: " + consecutiveErrors);
                        }
                        consecutiveErrors = Math.max(0, consecutiveErrors - 1);
                    })
                    .catch(err => {
                        console.error(err);
                        consecutiveErrors++;
                        log("Added error token. Total: " + consecutiveErrors);

                        if (consecutiveErrors >= consecutiveErrorsMax) {
                            log("Too many consecutive discord message sending errors, restarting");
                            process.exit(1);
                        }
                    });
            }

        }
    }
}, 1000);