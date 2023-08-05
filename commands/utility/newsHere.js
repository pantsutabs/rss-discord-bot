const fs = require('fs');
const { SlashCommandBuilder } = require('discord.js');
const { dataFilePath } = require('../../config.json');

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

module.exports = {
	data: new SlashCommandBuilder()
		.setName('news-here')
		.setDescription('Starts posting news in this channel!'),
	async execute(interaction) {
        dataFile = await getJson(dataFilePath);
        dataFile.guildsToUpdate[interaction.guildId] = {channelId:interaction.channelId}
        await saveJson(dataFilePath, dataFile);
        await interaction.reply('Yay! News time! News time! News time!');
	},
};